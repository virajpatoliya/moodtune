import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSaavnRadio,
  clearSaavnCache,
  decodeEntities,
  fetchSaavnMoodMix,
  fetchSaavnRadio,
  fetchSaavnSuggestions,
  moodPlaylistQueries,
  normalizeSaavnSongs,
  pickAudioUrl,
  rankSearchResults,
  searchSaavn,
} from './saavn.js';

const audio = (id) => ['48kbps', '160kbps', '320kbps'].map((quality) => ({ quality, url: `https://aac.saavncdn.com/${id}_${quality}.mp4` }));

function raw(id, name, artist, { duration = 240, playCount = 0, artistId = `a-${artist}`, album = 'Album', language = 'hindi' } = {}) {
  return {
    id,
    name,
    duration,
    playCount,
    language,
    url: `https://www.jiosaavn.com/song/${id}`,
    album: { id: `al-${album}`, name: album },
    artists: { primary: [{ id: artistId, name: artist }] },
    image: [{ quality: '150x150', url: 'small.jpg' }, { quality: '500x500', url: `${id}.jpg` }],
    downloadUrl: audio(id),
  };
}

function fakeFetcher(routes) {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    const { pathname, searchParams } = new URL(url);
    const route = routes.find(([match]) => match(pathname.replace('/api', ''), searchParams));
    if (!route) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, json: async () => ({ success: true, data: route[1](searchParams) }) };
  };
  return { fetcher, calls };
}

test.beforeEach(() => clearSaavnCache());

test('normalizes JioSaavn songs into full-track songs with a direct stream', () => {
  const [song, ...rest] = normalizeSaavnSongs([
    raw('aRZbUYD7', 'Tum Hi Ho', 'Arijit Singh', { album: 'Aashiqui 2', playCount: 374306490 }),
    raw('short', 'Intro', 'X', { duration: 20 }),
    raw('long', 'Jukebox', 'X', { duration: 3000 }),
    { ...raw('nourl', 'No Stream', 'X'), downloadUrl: [] },
  ]);
  assert.equal(rest.length, 0);
  assert.equal(song.id, 'saavn-aRZbUYD7');
  assert.equal(song.source, 'saavn');
  assert.equal(song.fullTrack, true);
  assert.equal(song.language, 'Hindi');
  assert.equal(song.realCoverUrl, 'aRZbUYD7.jpg');
  assert.equal(song.resolvedAudioUrl, 'https://aac.saavncdn.com/aRZbUYD7_160kbps.mp4');
  assert.deepEqual(song.saavnArtistIds, ['a-Arijit Singh']);
});

test('decodes entities and picks a sensible bitrate', () => {
  assert.equal(decodeEntities('Gehra Hua (From &quot;Dhurandhar&quot;)'), 'Gehra Hua (From "Dhurandhar")');
  assert.equal(pickAudioUrl([{ quality: '96kbps', url: 'a' }, { quality: '320kbps', url: 'b' }]), 'b');
  assert.equal(pickAudioUrl([]), null);
});

test('ranks the popular original above covers and karaoke', () => {
  const songs = normalizeSaavnSongs([
    raw('k', 'Tum Hi Ho (Karaoke Version)', 'Sing Along', { playCount: 900 }),
    raw('c', 'Tum Hi Ho', 'Cover Band', { playCount: 1200 }),
    raw('o', 'Tum Hi Ho', 'Arijit Singh', { playCount: 374306490 }),
    raw('x', 'Something Else', 'Other', { playCount: 99999999 }),
  ]);
  assert.deepEqual(rankSearchResults('tum hi ho', songs).map((song) => song.saavnId), ['o', 'c', 'k', 'x']);
  assert.equal(rankSearchResults('tum hi ho karaoke', songs)[0].saavnId, 'k');
});

test('artist searches lead with that artist\'s popular songs', async () => {
  const { fetcher } = fakeFetcher([
    [(path) => path === '/search/songs', () => ({ results: [raw('s1', 'Arijit Mashup', 'DJ Someone')] })],
    [(path) => path === '/search/artists', () => ({ results: [{ id: '459320', name: 'Arijit Singh' }] })],
    [(path) => path === '/artists/459320/songs', () => ({ songs: [raw('p1', 'Tum Hi Ho', 'Arijit Singh', { artistId: '459320' }), raw('p2', 'Apna Bana Le', 'Arijit Singh', { artistId: '459320' })] })],
  ]);
  const songs = await searchSaavn('arijit singh', undefined, {}, { fetcher });
  assert.deepEqual(songs.map((song) => song.saavnId), ['p1', 'p2', 's1']);
});

test('search still works when the artist lookup fails, and errors when everything fails', async () => {
  const partial = fakeFetcher([[(path) => path === '/search/songs', () => ({ results: [raw('s1', 'Kesariya', 'Pritam')] })]]);
  assert.deepEqual((await searchSaavn('kesariya', undefined, {}, { fetcher: partial.fetcher })).map((song) => song.saavnId), ['s1']);
  clearSaavnCache();
  const down = { fetcher: async () => { throw new TypeError('Failed to fetch'); } };
  await assert.rejects(searchSaavn('kesariya', undefined, {}, down), /busy right now/);
});

test('builds mood playlist queries from mood, goal and language', () => {
  assert.deepEqual(moodPlaylistQueries({ mood: 'romantic', intent: 'match', language: 'Hindi' }), ['romantic hindi']);
  assert.deepEqual(moodPlaylistQueries({ mood: 'sad', intent: 'uplift', language: 'Punjabi' }), ['happy punjabi']);
  assert.deepEqual(moodPlaylistQueries({ mood: 'calm', language: 'Instrumental' }), ['chill instrumental']);
  assert.deepEqual(moodPlaylistQueries({ mood: 'happy', language: 'Surprise' }), ['happy hindi', 'happy english']);
});

test('mood mix fills 12 full songs from mood playlists and rotates on refresh', async () => {
  const playlistSongs = (prefix) => Array.from({ length: 15 }, (_, i) => raw(`${prefix}${i}`, `${prefix} Song ${i}`, `${prefix} Artist ${i}`));
  const { fetcher, calls } = fakeFetcher([
    [(path) => path === '/search/playlists', () => ({ results: [{ id: '1', name: 'Romantic Hits', url: 'https://jiosaavn.com/featured/a' }, { id: '2', name: '2000s Romantic', url: 'https://jiosaavn.com/featured/b' }] })],
    [(path) => path === '/playlists', (params) => ({ songs: playlistSongs(params.get('link').endsWith('/a') ? 'A' : 'B') })],
  ]);
  const first = await fetchSaavnMoodMix({ mood: 'romantic', intent: 'match', language: 'Hindi' }, 0, undefined, { fetcher });
  assert.equal(first.length, 12);
  assert.ok(first.every((song) => song.fullTrack && song.resolvedAudioUrl));
  assert.match(first[0].baseReason, /Romantic Hits/);
  assert.ok(calls.some((url) => url.includes('query=romantic+hindi')));
  const refreshed = await fetchSaavnMoodMix({ mood: 'romantic', intent: 'match', language: 'Hindi' }, 1, undefined, { fetcher });
  assert.notDeepEqual(refreshed.map((song) => song.id), first.map((song) => song.id));
});

test('suggestions come from mix artists and skip songs already in the mix', async () => {
  const seed = normalizeSaavnSongs([raw('m1', 'Mix Song', 'Pritam', { artistId: 'pritam' })]);
  const { fetcher } = fakeFetcher([
    [(path) => path === '/artists/pritam/songs', () => ({ songs: [raw('m1', 'Mix Song', 'Pritam', { artistId: 'pritam' }), raw('n1', 'Kesariya', 'Pritam', { artistId: 'pritam' })] })],
  ]);
  const songs = await fetchSaavnSuggestions(seed, { excludeIds: ['saavn-m1'] }, undefined, { fetcher });
  assert.deepEqual(songs.map((song) => song.saavnId), ['n1']);
  assert.match(songs[0].baseReason, /Pritam/);
});

test('song radio queues 15+ full songs and never repeats the seed', async () => {
  const [seed] = normalizeSaavnSongs([raw('seed', 'Tum Hi Ho', 'Arijit Singh', { artistId: 'arijit', album: 'Aashiqui 2' })]);
  const list = (prefix, n) => Array.from({ length: n }, (_, i) => raw(`${prefix}${i}`, `${prefix} Track ${i}`, `${prefix} Singer`, { artistId: prefix }));
  const { fetcher } = fakeFetcher([
    [(path) => path === '/artists/arijit/songs', (params) => ({ songs: [raw('seed', 'Tum Hi Ho', 'Arijit Singh'), ...list(`art${params.get('page')}-`, 8)] })],
    [(path) => path === '/search/playlists', () => ({ results: [{ id: 'p', name: 'Romantic Hits', url: 'https://jiosaavn.com/featured/p' }] })],
    [(path) => path === '/playlists', () => ({ songs: list('pl', 12) })],
    [(path) => path === '/albums', () => ({ songs: [raw('seed2', 'Tum Hi Ho', 'Arijit Singh'), ...list('alb', 4)] })],
  ]);
  const { songs, error } = await fetchSaavnRadio(seed, { mood: 'romantic', language: 'Hindi', excludeIds: ['saavn-pl0'] }, undefined, { fetcher });
  assert.ok(songs.length >= 15, `got ${songs.length}`);
  assert.equal(error, '');
  assert.ok(songs.every((song) => song.title !== 'Tum Hi Ho' && song.id !== 'saavn-pl0'));
  assert.ok(songs.every((song) => song.matchWhy));
  assert.equal(new Set(songs.map((song) => song.id)).size, songs.length);
});

test('buildSaavnRadio interleaves groups and caps the queue', () => {
  const [seed] = normalizeSaavnSongs([raw('seed', 'Seed', 'A')]);
  const group = (prefix) => normalizeSaavnSongs(Array.from({ length: 15 }, (_, i) => raw(`${prefix}${i}`, `${prefix}${i}`, prefix)));
  const songs = buildSaavnRadio(seed, [group('x'), group('y')]);
  assert.equal(songs.length, 20);
  assert.deepEqual(songs.slice(0, 2).map((song) => song.saavnId), ['x0', 'y0']);
});
