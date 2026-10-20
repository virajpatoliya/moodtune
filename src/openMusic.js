// Audius (https://audius.co) is an open, artist-owned music platform with a public,
// key-free API. Artists upload and choose to make tracks streamable, so full-length
// playback is permitted. Catalog is mostly independent artists, not major-label hits.
export const AUDIUS_API = 'https://api.audius.co/v1';
export const AUDIUS_APP_NAME = 'moodtune';
export const OPEN_MIX_SIZE = 12;
// Hour-long DJ mixes and podcasts don't fit a mood-song feed.
export const MAX_TRACK_SECONDS = 15 * 60;

export const AUDIUS_MOODS = {
  happy: ['Upbeat', 'Excited'],
  calm: ['Peaceful', 'Easygoing'],
  sad: ['Melancholy', 'Sentimental', 'Yearning'],
  stressed: ['Peaceful', 'Tender'],
  romantic: ['Romantic', 'Tender', 'Sensual'],
  motivated: ['Energizing', 'Empowering'],
};

const PAGE_SIZE = 20;
const PAGES = 5;
// Fan re-uploads of commercial songs tend to carry these markers; skip them.
const RIP_PATTERN = /\b(320\s?kbps|128\s?kbps|mp3|full song|official (audio|video)|lyrical video)\b/i;

export function isLikelyRip(title = '') {
  return RIP_PATTERN.test(title);
}

export function audiusMoodsFor(mood) {
  return AUDIUS_MOODS[mood] || AUDIUS_MOODS.calm;
}

export function audiusStreamUrl(id) {
  return `${AUDIUS_API}/tracks/${encodeURIComponent(id)}/stream?app_name=${AUDIUS_APP_NAME}`;
}

export function normalizeAudiusTracks(items, { mood, intent } = {}) {
  const seen = new Set();
  const recordings = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item?.id || !item.title || item.is_streamable === false || item.is_stream_gated || item.is_delete) return false;
    if (isLikelyRip(item.title)) return false;
    if (Number(item.duration) > MAX_TRACK_SECONDS) return false;
    const recording = `${item.title.trim().toLowerCase()}:${item.user?.name?.trim().toLowerCase()}`;
    if (seen.has(item.id) || recordings.has(recording)) return false;
    seen.add(item.id);
    recordings.add(recording);
    return true;
  }).map((item) => ({
    id: `audius-${item.id}`,
    audiusId: item.id,
    audiusUserId: item.user?.id || null,
    source: 'audius',
    fullTrack: true,
    title: item.title.trim(),
    artist: item.user?.name || 'Independent artist',
    album: 'Audius',
    genre: item.genre || null,
    audiusMood: item.mood || null,
    language: 'Open',
    duration: Number(item.duration) || 30,
    moods: mood ? [mood] : [],
    intents: intent ? [intent] : [],
    artColors: ['#7e1bcc', '#cc0fe0', '#0f172a'],
    resolvedAudioUrl: audiusStreamUrl(item.id),
    realCoverUrl: item.artwork?.['480x480'] || item.artwork?.['150x150'] || null,
    pageUrl: item.permalink ? `https://audius.co${item.permalink}` : null,
    releaseDate: item.release_date || null,
    baseReason: `Full track from Audius, an open music platform${item.mood ? `, tagged "${item.mood}" by the artist` : ''}.`,
  }));
}

const cache = new Map();

export async function fetchAudius(path, params = {}, signal) {
  signal?.throwIfAborted();
  const query = new URLSearchParams({ ...params, app_name: AUDIUS_APP_NAME });
  const url = `${AUDIUS_API}${path}?${query}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Open music unavailable (HTTP ${response.status}).`);
  const body = await response.json();
  if (!Array.isArray(body?.data)) throw new Error('Open music returned an invalid response.');
  if (cache.size >= 100) cache.delete(cache.keys().next().value);
  cache.set(url, { data: body.data, expires: Date.now() + 10 * 60 * 1000 });
  return body.data;
}

export async function searchOpenMusic(term, signal, preferences) {
  const items = await fetchAudius('/tracks/search', { query: term.trim(), limit: String(PAGE_SIZE) }, signal);
  return normalizeAudiusTracks(items, preferences);
}

// Interleave so one Audius mood doesn't dominate the row.
export function interleave(groups) {
  const out = [];
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let i = 0; i < longest; i += 1) groups.forEach((group) => group[i] && out.push(group[i]));
  return out;
}

export function openMixRequests(mood, revision = 0) {
  const offset = String((Math.abs(revision) % PAGES) * PAGE_SIZE);
  return audiusMoodsFor(mood).slice(0, 2).map((audiusMood) => ({ query: '', mood: audiusMood, limit: String(PAGE_SIZE), offset }));
}

export async function fetchOpenMoodMix({ mood, intent }, revision, signal) {
  const results = await Promise.allSettled(openMixRequests(mood, revision).map((params) => fetchAudius('/tracks/search', params, signal)));
  const groups = results.map((result) => result.status === 'fulfilled' ? normalizeAudiusTracks(result.value, { mood, intent }) : []);
  if (groups.every((group) => !group.length)) {
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  return dedupe(interleave(groups)).slice(0, OPEN_MIX_SIZE);
}

function dedupe(songs) {
  const seen = new Set();
  return songs.filter((song) => !seen.has(song.id) && seen.add(song.id));
}

export function buildOpenRadio(seed, { artistTracks = [], styleTracks = [], moodTracks = [], excludeIds = [], target = 20 }) {
  const excluded = new Set([seed.id, ...excludeIds]);
  const tag = (songs, reason) => songs.map((song) => ({ ...song, matchWhy: reason }));
  const pool = [
    ...tag(artistTracks, `More from ${seed.artist} on Audius.`),
    ...tag(styleTracks, `Same genre${seed.audiusMood ? ' and mood' : ''} as ${seed.title} on Audius.`),
    ...tag(moodTracks, `Same mood tag${seed.audiusMood ? ` (${seed.audiusMood})` : ''} on Audius.`),
  ];
  return dedupe(pool).filter((song) => !excluded.has(song.id)).slice(0, target);
}

export async function fetchOpenRadio(seed, { excludeIds = [], mood } = {}, signal) {
  const audiusMood = seed.audiusMood || audiusMoodsFor(mood)[0];
  const requests = [
    seed.audiusUserId ? fetchAudius(`/users/${encodeURIComponent(seed.audiusUserId)}/tracks`, { limit: '10', sort: 'plays' }, signal) : Promise.resolve([]),
    seed.genre ? fetchAudius('/tracks/search', { query: '', genre: seed.genre, ...(seed.audiusMood ? { mood: seed.audiusMood } : {}), limit: String(PAGE_SIZE) }, signal) : Promise.resolve([]),
    fetchAudius('/tracks/search', { query: '', mood: audiusMood, limit: String(PAGE_SIZE) }, signal),
  ];
  const results = await Promise.allSettled(requests);
  const [artistTracks, styleTracks, moodTracks] = results.map((result) => result.status === 'fulfilled' ? normalizeAudiusTracks(result.value, { mood }) : []);
  const songs = buildOpenRadio(seed, { artistTracks, styleTracks, moodTracks, excludeIds });
  const failures = results.filter((result) => result.status === 'rejected');
  if (!songs.length && failures.length) throw failures[0].reason;
  return { songs, error: failures.length ? 'Some open-music lookups failed; showing what was found.' : '' };
}

// "You Might Also Like": popular tracks from the artists in the mood mix, then
// same-genre tracks, so the row extends the mix instead of repeating it.
export async function fetchOpenSuggestions(seedSongs, { excludeIds = [], mood, intent, revision = 0 } = {}, signal) {
  const artists = [];
  seedSongs.forEach((song) => {
    if (song.audiusUserId && !artists.some((entry) => entry.audiusUserId === song.audiusUserId)) artists.push(song);
  });
  const genres = [...new Set(seedSongs.map((song) => song.genre).filter(Boolean))].slice(0, 2);
  const offset = String((Math.abs(revision) % PAGES) * PAGE_SIZE);
  const requests = [
    ...artists.slice(0, 3).map((song) => fetchAudius(`/users/${encodeURIComponent(song.audiusUserId)}/tracks`, { limit: '6', sort: 'plays' }, signal)),
    ...genres.map((genre) => fetchAudius('/tracks/search', { query: '', genre, mood: audiusMoodsFor(mood)[0], limit: String(PAGE_SIZE), offset }, signal)),
  ];
  const results = await Promise.allSettled(requests);
  const groups = results.map((result) => result.status === 'fulfilled' ? normalizeAudiusTracks(result.value, { mood, intent }) : []);
  const excluded = new Set(excludeIds);
  const songs = dedupe(interleave(groups)).filter((song) => !excluded.has(song.id)).slice(0, OPEN_MIX_SIZE);
  const failure = results.find((result) => result.status === 'rejected');
  if (!songs.length && failure) throw failure.reason;
  return songs;
}
