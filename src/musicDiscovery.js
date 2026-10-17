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
  const terms = MOOD_TERMS[mood];
  const intentTerms = INTENT_TERMS[intent] || terms;
  const prefix = language === 'Surprise' ? '' : language === 'Instrumental' ? 'instrumental' : language;
  return [...new Set([
    `${prefix} ${terms[revision % terms.length]}`.trim(),
    `${prefix} ${intentTerms[(revision + 1) % intentTerms.length]}`.trim(),
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

export function relatedQueries(song, mood, intent, language) {
  const moodQuery = discoveryQueries(mood, intent, language)[0];
  return [...new Set([
    song.artist,
    `${song.genre || song.artist} ${moodQuery}`,
  ])];
}

export function buildRelatedMix(groups, seed, preferences) {
  const seedTitle = seed.title.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  return buildDiscoveryMix(groups, { ...preferences, language: 'Global' })
    .filter((song) => song.id !== seed.id && song.title.toLowerCase().replace(/\s*\([^)]*\)/g, '').trim() !== seedTitle)
    .map((song) => ({
      ...song,
      matchWhy: `Song radio inspired by ${seed.title}: artist and genre searches blended with your mood preference. Similarity and mood are suggestions, not audio analysis.`,
    }));
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

export async function searchMusic(term, signal) {
  const params = new URLSearchParams({
    term, media: 'music', entity: 'song', limit: '30', country: 'IN',
  });
  const response = await fetch(`https://itunes.apple.com/search?${params}`, { signal });
  if (!response.ok) throw new Error(`Music search unavailable (HTTP ${response.status}).`);
  const data = await response.json();
  if (!Array.isArray(data.results)) throw new Error('Music service returned an invalid response.');
  return data.results;
}
