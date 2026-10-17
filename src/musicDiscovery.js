const MOOD_TERMS = {
  happy: ['happy', 'dance', 'feel good'],
  calm: ['acoustic', 'chill', 'peaceful'],
  sad: ['heartbreak', 'sad', 'ballad'],
  stressed: ['ambient', 'meditation', 'relaxing'],
  romantic: ['love', 'romantic', 'romance'],
  motivated: ['workout', 'motivation', 'electronic'],
};

const INTENT_TERMS = {
  match: null,
  uplift: ['uplifting', 'happy', 'positive'],
  relax: ['acoustic', 'relaxing', 'chill'],
  energetic: ['dance', 'workout', 'party'],
  meaningful: ['soul', 'ballad', 'singer songwriter'],
};

export function discoveryQueries(mood, intent, language, revision = 0) {
  const terms = INTENT_TERMS[intent] || MOOD_TERMS[mood];
  const prefix = language === 'Surprise' ? '' : language === 'Instrumental' ? 'instrumental' : language;
  return [...new Set([
    `${prefix} ${terms[revision % terms.length]}`.trim(),
    `${prefix} ${terms[(revision + 1) % terms.length]}`.trim(),
  ])];
}

export function normalizeTracks(items, { mood, intent, language = 'Global' }) {
  const seen = new Set();
  const recordings = new Set();
  return items.filter((item) => {
    const recording = `${item.trackName?.trim().toLowerCase()}:${item.artistName?.trim().toLowerCase()}`;
    if (!item.trackId || !item.trackName || !item.previewUrl || seen.has(item.trackId) || recordings.has(recording)) return false;
    seen.add(item.trackId);
    recordings.add(recording);
    return true;
  }).map((item) => ({
    id: `itunes-${item.trackId}`,
    title: item.trackName,
    artist: item.artistName || 'Unknown artist',
    album: item.collectionName || 'Single',
    genre: item.primaryGenreName || null,
    language: language === 'Surprise' ? 'Global' : language,
    duration: 30,
    moods: [mood],
    intents: [intent],
    artColors: ['#8b5cf6', '#f43f5e', '#0f172a'],
    resolvedAudioUrl: item.previewUrl,
    realCoverUrl: item.artworkUrl100?.replace('100x100bb', '480x480bb') || null,
    releaseDate: item.releaseDate,
    baseReason: 'Discovered through your listening preferences. Mood and language are search hints, not verified audio attributes.',
  }));
}

export function buildDiscoveryMix(groups, preferences) {
  const length = Math.max(0, ...groups.map((group) => group.length));
  const interleaved = Array.from({ length }, (_, index) => groups.flatMap((group) => group[index] ? [group[index]] : [])).flat();
  const songs = normalizeTracks(interleaved, preferences);
  const artists = new Set();
  const titles = new Set();
  const firstPicks = [];
  const moreFromArtists = [];
  for (const song of songs) {
    const artist = song.artist.toLowerCase();
    const title = song.title.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
    if (artists.has(artist) || titles.has(title)) moreFromArtists.push(song);
    else {
      artists.add(artist);
      titles.add(title);
      firstPicks.push(song);
    }
  }
  return [...firstPicks, ...moreFromArtists];
}

const INTENT_MOODS = { uplift: 'happy', relax: 'calm', energetic: 'motivated', meaningful: 'sad' };

export function prioritizeFreshSongs(songs, seenTitles = [], limit = songs.length) {
  const recent = new Map(seenTitles.map((title, index) => [recordingTitle(title), index]));
  return songs.map((song, index) => ({ song, index, lastSeen: recent.get(recordingTitle(song.title)) ?? -1 }))
    .sort((a, b) => a.lastSeen - b.lastSeen || a.index - b.index)
    .slice(0, limit)
    .map(({ song }) => song);
}

export function moodDiscoverySeeds(catalog, { mood, intent, language }, revision = 0, seenTitles = []) {
  const target = intent === 'match' ? mood : INTENT_MOODS[intent];
  const candidates = [...new Map(catalog.filter((song) =>
    (language === 'Surprise' || song.language === language)
    && song.moods.includes(target)
    && (intent === 'match' || song.intents.includes(intent)))
    .map((song) => [`${recordingTitle(song.title)}:${recordingArtists(song.artist).sort().join(',')}`, song])).values()];
  const languages = [...new Set(candidates.map((song) => song.language))];
  const groups = languages.map((lang) => candidates.filter((song) => song.language === lang));
  const balanced = [];
  for (let index = 0; index < Math.max(0, ...groups.map((group) => group.length)); index++) {
    for (const group of groups) if (group[index]) balanced.push(group[index]);
  }
  if (!balanced.length) return [];
  const offset = revision % balanced.length;
  return prioritizeFreshSongs([...balanced.slice(offset), ...balanced.slice(0, offset)], seenTitles, 18);
}

function recordingTitle(value) {
  return value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/\((?:from |feat\.? |featuring )[^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function recordingArtists(value) {
  return artistNames(value).map((artist) => artist.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim());
}

export function resolveMoodMix(groups, seeds, { mood, intent }) {
  const songs = seeds.flatMap((seed, index) => {
    const expectedTitle = recordingTitle(seed.title);
    const expectedArtists = recordingArtists(seed.artist);
    const matches = (groups[index] || []).filter((item) =>
      recordingTitle(item.trackName || '') === expectedTitle
      && expectedArtists.some((artist) => recordingArtists(item.artistName || '').includes(artist))
      && !/\b(karaoke|tribute|cover|remix|sped up|slowed|lofi|lo-fi)\b/i.test(`${item.trackName} ${item.collectionName}`));
    const track = normalizeTracks(matches, { mood, intent, language: seed.language })[0];
    if (!track) return [];
    return [{
      ...track,
      moods: seed.moods,
      intents: seed.intents,
      baseReason: `A curated ${seed.language} pick for ${intent === 'match' ? `your ${mood} mood` : { uplift: 'lifting your mood', relax: 'unwinding', energetic: 'an energy boost', meaningful: 'reflection' }[intent]}. Mood fit is subjective.`,
    }];
  });
  return [...new Map(songs.map((song) => [song.id, song])).values()];
}

const RADIO_STYLES = [
  { label: 'Garba / Dandiya', query: 'garba dandiya', pattern: /garba|garbo|garbe|dandiya|navratri|નવરાત્રી|ગરબા|ગરબો|डांडिया|गरबा/i },
  { label: 'Bhajan', query: 'bhajan', pattern: /bhajan|ભજન|भजन/i },
  { label: 'Qawwali', query: 'qawwali', pattern: /qawwali|kawwali|कव्वाली/i },
  { label: 'Ghazal', query: 'ghazal', pattern: /ghazal|gazal|ગઝલ|ग़ज़ल|गजल/i },
  { label: 'Lo-fi', query: 'lofi', pattern: /\blo[\s-]?fi\b/i },
];

function radioStyle(song) {
  const metadata = `${song.title} ${song.album || ''} ${song.genre || ''}`;
  return RADIO_STYLES.find((style) => style.pattern.test(metadata));
}

function artistNames(artist) {
  return artist.toLowerCase().split(/\s*(?:,|&| feat\.? | featuring | and | x )\s*/).map((name) => name.trim()).filter(Boolean);
}

export function relatedQueries(song) {
  const style = radioStyle(song);
  if (style) return [`${song.artist} ${style.query}`, style.query];
  return [...new Set([song.artist, `${song.artist} ${song.genre || song.album || ''}`.trim()])];
}

export function buildRelatedMix(groups, seed, preferences) {
  const seedTitle = seed.title.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  const style = radioStyle(seed);
  const seedArtists = artistNames(seed.artist);
  const genre = seed.genre?.toLowerCase();
  return buildDiscoveryMix(groups, { ...preferences, language: 'Global' })
    .filter((song) => song.id !== seed.id && song.title.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim() !== seedTitle)
    .filter((song) => {
      if (style) return radioStyle(song)?.label === style.label;
      const sameArtist = seedArtists.some((artist) => artist !== 'unknown artist' && artistNames(song.artist).includes(artist));
      const sameGenre = genre && song.genre?.toLowerCase() === genre;
      return sameArtist && (!genre || sameGenre);
    })
    .map((song) => ({
      ...song,
      matchWhy: style
        ? `${style.label} radio from "${seed.title}". Matched using song, album, or genre text; not verified audio analysis.`
        : `Related to "${seed.title}" through a shared artist${genre ? ' and genre' : ''}. Metadata-based suggestions, not verified audio similarity.`,
    }));
}

export function moodSuggestionQuery(song) {
  const artist = artistNames(song.artist)[0];
  const style = radioStyle(song);
  return style ? `${artist} ${style.query}` : artist;
}

export function buildMoodSuggestions(groups, seeds, excludedSongs, revision = 0, seenTitles = []) {
  const excludedIds = new Set(excludedSongs.map((song) => song.id));
  const sameRecording = (a, b) => recordingTitle(a.title) === recordingTitle(b.title)
    && recordingArtists(a.artist).some((artist) => recordingArtists(b.artist).includes(artist));
  const related = groups.map((group, index) =>
    buildRelatedMix([group], { ...seeds[index], genre: null }, { mood: null, intent: null })
      .filter((song) => !/\b(karaoke|tribute|cover|remix|sped up|slowed)\b/i.test(`${song.title} ${song.album}`)
        && (radioStyle(seeds[index]) || !radioStyle(song))
        && (radioStyle(seeds[index])?.label === 'Lo-fi' || !/\blo[\s-]?fi\b/i.test(`${song.title} ${song.album}`))));
  const songs = [];
  for (let index = 0; index < Math.max(0, ...related.map((group) => group.length)); index++) {
    for (const group of related) {
      const song = group[index];
      if (!song) continue;
      if (excludedIds.has(song.id) || excludedSongs.some((excluded) => sameRecording(song, excluded))
        || songs.some((previous) => sameRecording(song, previous))) continue;
      songs.push(song);
    }
  }
  const offset = songs.length ? revision % songs.length : 0;
  return prioritizeFreshSongs([...songs.slice(offset), ...songs.slice(0, offset)], seenTitles, 6);
}

export function upcomingTracks(tracks, currentId) {
  const index = tracks.findIndex((song) => song.id === currentId);
  return index < 0 ? tracks : [...tracks.slice(index + 1), ...tracks.slice(0, index)];
}

export function buildTasteMix(groups, terms, revision = 0) {
  const rotated = groups.map((group) => {
    if (!group.length) return group;
    const offset = (revision * 2) % group.length;
    return [...group.slice(offset), ...group.slice(0, offset)];
  });
  return buildDiscoveryMix(rotated, { mood: null, intent: null })
    .slice(0, 6)
    .map((song) => {
      const source = groups.findIndex((group) => group.some((item) => `itunes-${item.trackId}` === song.id));
      return {
        ...song,
        searchTerm: terms[source],
        matchWhy: `Suggested from your recent search for "${terms[source]}". Search-based discovery, not a verified prediction of your taste.`,
      };
    });
}

const searchCache = new Map();

export async function searchMusic(term, signal) {
  signal?.throwIfAborted();
  const key = term.trim().toLowerCase().replace(/\s+/g, ' ');
  const cached = searchCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.results;
  const params = new URLSearchParams({
    term, media: 'music', entity: 'song', limit: '30', country: 'IN',
  });
  const response = await fetch(`https://itunes.apple.com/search?${params}`, { signal });
  if (!response.ok) throw new Error(`Music search unavailable (HTTP ${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error('Music service returned an invalid response.');
  if (searchCache.size >= 150) searchCache.delete(searchCache.keys().next().value);
  searchCache.set(key, { results: data.results, expires: Date.now() + 10 * 60 * 1000 });
  return data.results;
}

export async function searchMusicBatch(terms, signal) {
  const responses = await Promise.allSettled(terms.map((term) => searchMusic(term, signal)));
  const failures = responses.filter((response) => response.status === 'rejected');
  const groups = responses.map((response) => response.status === 'fulfilled' ? response.value : []);
  if (failures.length === responses.length && failures.length) throw failures[0].reason;
  const error = failures.length
    ? `${failures.length} music searches could not finish. ${failures[0].reason.message} Showing available previews; retry for more.`
    : '';
  return { groups, error };
}
