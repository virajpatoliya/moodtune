// Full-length songs from JioSaavn via the open-source jiosaavn-api project
// (https://github.com/sumitkolhe/jiosaavn-api). Its public instance needs no key,
// allows browser requests (CORS), and returns direct AAC streams that play in a
// normal <audio> element, so there are no embed restrictions or 30s previews.
import { interleave } from './openMusic.js';

export const SAAVN_API = 'https://saavn.sumit.co/api';
export const SAAVN_MIX_SIZE = 12;
const MIN_SECONDS = 45;
const MAX_SECONDS = 15 * 60;
const CACHE_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 9000;
const DEFAULT_RATE_LIMIT_MS = 60 * 1000;
const BUSY_MESSAGE = 'Song search is busy right now. Please try again in a moment.';

// JioSaavn playlist search is keyword-based and coverage differs per language
// (e.g. "gujarati chill" finds nothing), so each mood tries several words in order.
const MOOD_WORDS = {
  happy: ['happy', 'party', 'dance'],
  calm: ['chill', 'lofi', 'acoustic', 'relaxing'],
  sad: ['sad', 'heartbreak', 'romantic'],
  stressed: ['chill', 'lofi', 'relaxing', 'acoustic'],
  romantic: ['romantic', 'love'],
  motivated: ['workout', 'party', 'dance'],
};
const INTENT_WORDS = {
  uplift: ['happy', 'party', 'dance'],
  relax: ['chill', 'lofi', 'relaxing'],
  energetic: ['party', 'workout', 'dance'],
  meaningful: ['soulful', 'ghazal', 'sad', 'romantic'],
};
const FALLBACK_WORDS = ['hits'];
const LANGUAGE_WORDS = {
  Hindi: ['hindi'],
  English: ['english'],
  Gujarati: ['gujarati'],
  Punjabi: ['punjabi'],
  Instrumental: ['instrumental'],
  Surprise: ['hindi', 'english'],
  All: ['hindi', 'english', 'punjabi', 'gujarati'],
};
// Re-recordings that are rarely what someone searching a song title wants.
const VARIANT_PATTERN = /\b(karaoke|instrumental|cover|remix|lofi|lo-fi|slowed|reverb|nightcore|sped up|8d|unplugged|mashup|version|flip|techno|ambient)\b/i;

export function decodeEntities(text = '') {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

const capitalize = (word = '') => (word ? word[0].toUpperCase() + word.slice(1) : '');

function tokens(text = '') {
  return decodeEntities(text).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function titleKey(title = '') {
  return tokens(decodeEntities(title).replace(/\s*[([].*?[)\]]/g, '')).join(' ');
}

export function pickAudioUrl(downloadUrl = []) {
  const byQuality = new Map((Array.isArray(downloadUrl) ? downloadUrl : []).map((item) => [item.quality, item.url]));
  return byQuality.get('160kbps') || byQuality.get('320kbps') || byQuality.get('96kbps') || [...byQuality.values()].pop() || null;
}

function pickImage(images = []) {
  const list = Array.isArray(images) ? images : [];
  return (list.find((item) => item.quality === '500x500') || list[list.length - 1])?.url || null;
}

export function normalizeSaavnSongs(items, { mood, intent, reason } = {}) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const duration = Number(item?.duration);
    if (!item?.id || !item.name || !pickAudioUrl(item.downloadUrl)) return false;
    if (!(duration >= MIN_SECONDS && duration <= MAX_SECONDS)) return false;
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).map((item) => {
    const primary = item.artists?.primary || [];
    const artist = decodeEntities(primary.map((entry) => entry.name).join(', ')) || 'Unknown artist';
    const album = decodeEntities(item.album?.name || '');
    return {
      id: `saavn-${item.id}`,
      saavnId: item.id,
      saavnArtistIds: primary.map((entry) => entry.id).filter(Boolean),
      saavnAlbumId: item.album?.id || null,
      source: 'saavn',
      fullTrack: true,
      title: decodeEntities(item.name),
      artist,
      album: album || 'Single',
      genre: null,
      language: capitalize(item.language) || 'Music',
      duration: Number(item.duration),
      playCount: Number(item.playCount) || 0,
      year: item.year || null,
      moods: mood ? [mood] : [],
      intents: intent ? [intent] : [],
      artColors: ['#0ea5e9', '#2bc5b4', '#0f172a'],
      resolvedAudioUrl: pickAudioUrl(item.downloadUrl),
      realCoverUrl: pickImage(item.image),
      pageUrl: item.url || null,
      releaseDate: item.releaseDate || null,
      baseReason: reason || `Full song from JioSaavn${album ? ` · ${album}` : ''}.`,
    };
  });
}

const cache = new Map();
let rateLimitedUntil = 0;
let unreachableUntil = 0;

function rateLimitError() {
  const seconds = Math.max(1, Math.ceil((rateLimitedUntil - Date.now()) / 1000));
  const error = new Error(`JioSaavn is limiting requests (HTTP 429). Try again in about ${seconds} seconds; the service may need longer.`);
  error.status = 429;
  return error;
}

function retryDelay(response) {
  const value = response.headers?.get?.('retry-after')?.trim();
  if (!value) return DEFAULT_RATE_LIMIT_MS;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : DEFAULT_RATE_LIMIT_MS;
}

function unreachableError(cause) {
  const seconds = Math.max(1, Math.ceil((unreachableUntil - Date.now()) / 1000));
  return new Error(`${BUSY_MESSAGE} JioSaavn could not be reached; try again in about ${seconds} seconds.`, cause ? { cause } : undefined);
}

export async function fetchSaavn(path, params = {}, signal, { fetcher = fetch } = {}) {
  signal?.throwIfAborted();
  const url = `${SAAVN_API}${path}?${new URLSearchParams(params)}`;
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (Date.now() < rateLimitedUntil) throw rateLimitError();
  if (Date.now() < unreachableUntil) throw unreachableError();
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const scoped = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response;
  try {
    response = await fetcher(url, { signal: scoped });
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    if (error instanceof TypeError || error?.name === 'TimeoutError') {
      unreachableUntil = Math.max(unreachableUntil, Date.now() + DEFAULT_RATE_LIMIT_MS);
      throw unreachableError(error);
    }
    throw new Error(BUSY_MESSAGE, { cause: error });
  }
  if (response.status === 429) {
    rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + retryDelay(response));
    throw rateLimitError();
  }
  if (!response.ok) throw new Error(`${BUSY_MESSAGE} (HTTP ${response.status})`);
  unreachableUntil = 0;
  const body = await response.json();
  if (!body?.success || !body.data) throw new Error(BUSY_MESSAGE);
  if (cache.size >= 150) cache.delete(cache.keys().next().value);
  cache.set(url, { data: body.data, expires: Date.now() + CACHE_MS });
  return body.data;
}

export function clearSaavnCache() {
  cache.clear();
  rateLimitedUntil = 0;
  unreachableUntil = 0;
}

const dedupe = (songs) => {
  const ids = new Set();
  const titles = new Set();
  return songs.filter((song) => {
    const key = `${titleKey(song.title)}|${song.artist.split(',').map((name) => titleKey(name)).sort().join(',')}`;
    if (ids.has(song.id) || titles.has(key)) return false;
    ids.add(song.id);
    titles.add(key);
    return true;
  });
};

// Prefer query matches over popularity, including a partial final word while typing.
export function rankSearchResults(term, songs, { artistSongIds = new Set() } = {}) {
  const query = tokens(term);
  const wantsVariant = VARIANT_PATTERN.test(term);
  return songs.map((song, index) => {
    const title = tokens(song.title);
    const words = new Set([...title, ...tokens(song.artist), ...tokens(song.album)]);
    const matches = (word, position, candidates) => candidates.has(word)
      ? 1
      : position === query.length - 1 && word.length >= 2 && [...candidates].some((candidate) => candidate.startsWith(word))
        ? 0.7
        : 0;
    const coverage = query.reduce((sum, word, position) => sum + matches(word, position, words), 0);
    const titleWords = new Set(title);
    const titleCoverage = query.reduce((sum, word, position) => sum + matches(word, position, titleWords), 0);
    return {
      song,
      index,
      coverage,
      artistSong: artistSongIds.has(song.id),
      exactTitle: query.length > 0 && titleKey(song.title) === query.join(' '),
      titleCoverage,
      variant: !wantsVariant && VARIANT_PATTERN.test(song.title),
    };
  }).sort((a, b) =>
    b.coverage - a.coverage ||
    Number(b.artistSong) - Number(a.artistSong) ||
    Number(b.exactTitle) - Number(a.exactTitle) ||
    b.titleCoverage - a.titleCoverage ||
    Number(a.variant) - Number(b.variant) ||
    b.song.playCount - a.song.playCount ||
    a.index - b.index
  ).map((entry) => entry.song);
}

function matchesArtist(term, artistName) {
  const query = tokens(term);
  const artist = tokens(artistName);
  return artist.length > 0 && query.join(' ') === artist.join(' ');
}

export async function searchSaavn(term, signal, preferences = {}, { limit = 20, fetcher } = {}) {
  const query = term.trim();
  const [songsResult, artistsResult] = await Promise.allSettled([
    fetchSaavn('/search/songs', { query, limit: '40' }, signal, { fetcher }),
    fetchSaavn('/search/artists', { query, limit: '1' }, signal, { fetcher }),
  ]);
  if (songsResult.status === 'rejected' && artistsResult.status === 'rejected') throw songsResult.reason;
  const found = songsResult.status === 'fulfilled' ? normalizeSaavnSongs(songsResult.value.results, preferences) : [];
  let artistSongs = [];
  let artistFailure;
  const artist = artistsResult.status === 'fulfilled' ? artistsResult.value.results?.[0] : null;
  if (artist?.id && matchesArtist(query, artist.name)) {
    try {
      const data = await fetchSaavn(`/artists/${encodeURIComponent(artist.id)}/songs`, { sortBy: 'popularity', sortOrder: 'desc', page: '0' }, signal, { fetcher });
      artistSongs = normalizeSaavnSongs(data?.songs, { ...preferences, reason: `Popular full song by ${decodeEntities(artist.name)}.` });
    } catch (error) {
      artistFailure = error;
    }
  }
  if (!found.length && !artistSongs.length && (songsResult.status === 'rejected' || artistFailure)) {
    throw songsResult.status === 'rejected' ? songsResult.reason : artistFailure;
  }
  const artistSongIds = new Set(artistSongs.map((song) => song.id));
  return dedupe(rankSearchResults(query, [...artistSongs, ...found], { artistSongIds })).slice(0, limit);
}

async function artistSongs(artistId, page, signal, options, reason, fetcher) {
  const data = await fetchSaavn(`/artists/${encodeURIComponent(artistId)}/songs`, { sortBy: 'popularity', sortOrder: 'desc', page: String(page) }, signal, { fetcher });
  return normalizeSaavnSongs(data?.songs, { ...options, reason });
}

async function playlistSongs(playlist, signal, options, fetcher, limit = 30) {
  const data = await fetchSaavn('/playlists', { link: playlist.url, limit: String(limit) }, signal, { fetcher });
  const name = decodeEntities(playlist.name || data?.name || 'JioSaavn');
  return normalizeSaavnSongs(data?.songs, { ...options, reason: `From JioSaavn's "${name}" playlist.` });
}

function moodWords({ mood, intent }) {
  const words = [...((intent && INTENT_WORDS[intent]) || []), ...(MOOD_WORDS[mood] || MOOD_WORDS.calm)];
  return [...new Set(words)].slice(0, 3);
}

// One ordered list of queries per language, most specific first.
export function moodPlaylistQueries({ mood, intent, language }) {
  const words = moodWords({ mood, intent });
  return (LANGUAGE_WORDS[language] || LANGUAGE_WORDS.Surprise).map((lang) => [
    ...words.map((word) => `${lang} ${word}`),
    ...FALLBACK_WORDS.map((word) => `${lang} ${word}`),
  ]);
}

const sameLanguage = (playlist, lang) => lang === 'instrumental'
  || playlist.language === lang
  || titleKey(playlist.name).includes(lang);

// Search alternative mood words only when earlier playlists cannot fill the mix.
async function songsForLanguage(queries, lang, wanted, revision, signal, options, fetcher) {
  const groups = [];
  const seen = new Set();
  let failure = null;
  let checked = 0;
  for (const query of queries) {
    if (groups.length >= wanted || checked >= 6) break;
    let data;
    try {
      data = await fetchSaavn('/search/playlists', { query, limit: '10' }, signal, { fetcher });
    } catch (error) {
      failure ||= error;
      if (error.status === 429 || signal?.aborted) break;
      continue;
    }
    const candidates = (data.results || []).filter((item) => item.url && !seen.has(item.id) && sameLanguage(item, lang));
    const shift = candidates.length ? Math.abs(revision) % candidates.length : 0;
    for (const playlist of [...candidates.slice(shift), ...candidates.slice(0, shift)]) {
      if (groups.length >= wanted || checked >= 6) break;
      if (seen.has(playlist.id)) continue;
      seen.add(playlist.id);
      checked += 1;
      try {
        const songs = await playlistSongs(playlist, signal, options, fetcher);
        if (songs.length) groups.push(songs);
      } catch (error) {
        failure ||= error;
        if (error.status === 429 || signal?.aborted) return { groups, failure };
      }
    }
  }
  return { groups, failure };
}

const MIN_PLAYLIST_SONGS = 6;

// Some catalogs (notably English) only have near-empty playlists in the open
// API, so top those languages up with a mood-word song search instead.
async function moodSearchSongs(preferences, lang, revision, signal, options, fetcher) {
  const words = moodWords(preferences);
  const word = words[Math.abs(revision) % words.length];
  const data = await fetchSaavn('/search/songs', { query: `${word} ${lang}`, limit: '30' }, signal, { fetcher });
  const songs = normalizeSaavnSongs(data?.results, { ...options, reason: `A ${word} ${capitalize(lang)} pick from JioSaavn.` });
  const matching = lang === 'instrumental' ? songs : songs.filter((song) => song.language.toLowerCase() === lang);
  return matching.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
}

async function moodPlaylistSongs(preferences, revision, signal, fetcher, options) {
  const lists = moodPlaylistQueries(preferences);
  const languages = LANGUAGE_WORDS[preferences.language] || LANGUAGE_WORDS.Surprise;
  const wanted = lists.length > 1 ? 1 : 2;
  const results = await Promise.all(lists.map(async (queries, index) => {
    const result = await songsForLanguage(queries, languages[index], wanted, revision, signal, options, fetcher);
    if (result.groups.flat().length >= MIN_PLAYLIST_SONGS) return result;
    try {
      const extra = await moodSearchSongs(preferences, languages[index], revision, signal, options, fetcher);
      if (extra.length) result.groups.push(extra);
    } catch (error) {
      result.failure ||= error;
    }
    return result;
  }));
  const groups = results.flatMap((result) => result.groups);
  if (!groups.length) {
    const failure = results.find((result) => result.failure)?.failure;
    throw failure || new Error('No full songs found for this mood right now.');
  }
  return groups;
}

export async function fetchSaavnMoodMix({ mood, intent, language }, revision = 0, signal, { fetcher } = {}) {
  const groups = await moodPlaylistSongs({ mood, intent, language }, revision, signal, fetcher, { mood, intent });
  // Rotate within the playlists so "Find a fresh mix" isn't the same top 12.
  const shift = Math.abs(revision) * 5;
  return dedupe(interleave(groups.map((group) => {
    const offset = shift % Math.max(1, group.length);
    return [...group.slice(offset), ...group.slice(0, offset)];
  }))).slice(0, SAAVN_MIX_SIZE);
}

export async function fetchSaavnSuggestions(seedSongs, { excludeIds = [], mood, intent, revision = 0 } = {}, signal, { fetcher } = {}) {
  const artists = [];
  seedSongs.forEach((song) => {
    const id = song.saavnArtistIds?.[0];
    if (id && !artists.some((entry) => entry.id === id)) artists.push({ id, name: song.artist.split(',')[0] });
  });
  const picked = artists.slice(Math.abs(revision) % Math.max(1, artists.length)).concat(artists).slice(0, 3);
  const page = Math.abs(revision) % 2;
  const results = await Promise.allSettled(picked.map((artist) => artistSongs(artist.id, page, signal, { mood, intent }, `More from ${artist.name}, an artist in your mood mix.`, fetcher)));
  const excluded = new Set(excludeIds);
  const excludedTitles = new Set(seedSongs.map((song) => titleKey(song.title)));
  const candidates = dedupe(interleave(results.map((result) => (result.status === 'fulfilled' ? result.value : []))))
    .filter((song) => !excluded.has(song.id) && !excludedTitles.has(titleKey(song.title)));
  const languages = new Set(seedSongs.map((song) => song.language));
  const sameLanguage = candidates.filter((song) => languages.has(song.language));
  const songs = (sameLanguage.length >= 6 ? sameLanguage : candidates).slice(0, SAAVN_MIX_SIZE);
  if (!songs.length) {
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  return songs;
}

export function buildSaavnRadio(seed, groups, { excludeIds = [], target = 20 } = {}) {
  const excluded = new Set([seed.id, ...excludeIds]);
  const seedTitle = titleKey(seed.title);
  return dedupe(interleave(groups))
    .filter((song) => !excluded.has(song.id) && titleKey(song.title) !== seedTitle)
    .slice(0, target);
}

// Song radio: the seed artist's popular songs, its album, and mood/language
// playlists, interleaved so the queue mixes familiar and new songs.
export async function fetchSaavnRadio(seed, { excludeIds = [], mood, intent, language, minimum = 15 } = {}, signal, { fetcher } = {}) {
  const [firstArtist, secondArtist] = seed.saavnArtistIds || [];
  const leadName = seed.artist.split(',')[0].trim();
  const requests = [
    firstArtist ? artistSongs(firstArtist, 0, signal, { mood }, `More from ${leadName}.`, fetcher) : Promise.resolve([]),
    moodPlaylistSongs({ mood, intent, language: !language || language === 'All' ? capitalize(seed.language) : language }, Math.floor(Math.random() * 5), signal, fetcher, { mood })
      .then((groups) => interleave(groups).map((song) => ({ ...song, baseReason: `${song.baseReason} Fits your ${mood || 'current'} mood.` }))),
    secondArtist ? artistSongs(secondArtist, 0, signal, { mood }, `More from ${seed.artist.split(',')[1]?.trim() || 'a featured artist'}.`, fetcher) : Promise.resolve([]),
    firstArtist ? artistSongs(firstArtist, 1, signal, { mood }, `More from ${leadName}.`, fetcher) : Promise.resolve([]),
    seed.saavnAlbumId ? fetchSaavn('/albums', { id: seed.saavnAlbumId }, signal, { fetcher })
      .then((data) => normalizeSaavnSongs(data?.songs, { mood, reason: `From the album ${seed.album}.` })) : Promise.resolve([]),
  ];
  const results = await Promise.allSettled(requests);
  const groups = results.map((result) => (result.status === 'fulfilled' ? result.value : []))
    .map((group) => group.map((song) => ({ ...song, matchWhy: song.baseReason })));
  const songs = buildSaavnRadio(seed, groups, { excludeIds });
  const failures = results.filter((result) => result.status === 'rejected');
  if (!songs.length && failures.length) throw failures[0].reason;
  return { songs, error: songs.length < minimum && failures.length ? 'Some song lookups failed; showing what was found.' : '' };
}
