import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSaavnRadio,
  clearSaavnCache,
  decodeEntities,
  fetchSaavn,
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

test('ranks complete song and artist matches above more popular partial matches', () => {
  const songs = normalizeSaavnSongs([
    raw('popular', 'Tum Hi Ho', 'Other Singer', { playCount: 900000000 }),
    raw('match', 'Tum Hi Ho', 'Arijit Singh', { playCount: 100 }),
    raw('unrelated', 'Another Song', 'Arijit Singh', { playCount: 900000000 }),
  ]);
  assert.equal(rankSearchResults('tum hi ho arijit singh', songs)[0].saavnId, 'match');
  assert.equal(rankSearchResults('tum hi ho arij', songs)[0].saavnId, 'match');
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

test('song and artist searches do not replace matching songs with unrelated artist hits', async () => {
  const { fetcher, calls } = fakeFetcher([
    [(path) => path === '/search/songs', () => ({ results: [
      raw('partial', 'Other Song', 'Arijit Singh', { playCount: 900000000 }),
      raw('match', 'Tum Hi Ho', 'Arijit Singh', { playCount: 100 }),
    ] })],
    [(path) => path === '/search/artists', () => ({ results: [{ id: '459320', name: 'Arijit Singh' }] })],
    [(path) => path === '/artists/459320/songs', () => ({ songs: [raw('hit', 'Unrelated Hit', 'Arijit Singh')] })],
  ]);
  const songs = await searchSaavn('tum hi ho arijit singh', undefined, {}, { fetcher });
  assert.equal(songs[0].saavnId, 'match');
  assert.ok(!calls.some((url) => url.includes('/artists/459320/songs')));
});

test('search still works when the artist lookup fails, and errors when everything fails', async () => {
  const partial = fakeFetcher([[(path) => path === '/search/songs', () => ({ results: [raw('s1', 'Kesariya', 'Pritam')] })]]);
  assert.deepEqual((await searchSaavn('kesariya', undefined, {}, { fetcher: partial.fetcher })).map((song) => song.saavnId), ['s1']);
  clearSaavnCache();
  const down = { fetcher: async () => { throw new TypeError('Failed to fetch'); } };
  await assert.rejects(searchSaavn('kesariya', undefined, {}, down), /busy right now/);
});

test('rate limiting respects Retry-After, avoids further requests and keeps cached results', async (t) => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  const fetcher = async (url) => {
    calls += 1;
    if (url.includes('limited') && calls === 2) {
      return { ok: false, status: 429, headers: new Headers({ 'retry-after': '2' }) };
    }
    return { ok: true, json: async () => ({ success: true, data: { results: [] } }) };
  };
  await fetchSaavn('/cached', {}, undefined, { fetcher });
  await assert.rejects(fetchSaavn('/limited', {}, undefined, { fetcher }), /HTTP 429.*2 seconds/);
  await assert.rejects(fetchSaavn('/another', {}, undefined, { fetcher }), /HTTP 429/);
  await fetchSaavn('/cached', {}, undefined, { fetcher });
  assert.equal(calls, 2);
  now += 2000;
  await fetchSaavn('/another', {}, undefined, { fetcher });
  assert.equal(calls, 3);
});

test('rate limiting without Retry-After backs off and stops mood-query retries', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return { ok: false, status: 429 };
  };
  await assert.rejects(fetchSaavnMoodMix({ mood: 'happy', language: 'All' }, 0, undefined, { fetcher }), /HTTP 429.*60 seconds/);
  assert.ok(calls <= 4, `made ${calls} requests`);
});

test('network failures also back off when a browser cannot expose the HTTP response', async (t) => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(fetchSaavn('/songs', {}, undefined, { fetcher }), /could not be reached.*60 seconds/);
  await assert.rejects(fetchSaavn('/playlists', {}, undefined, { fetcher }), /could not be reached/);
  assert.equal(calls, 1);
  now += 60_000;
  await assert.rejects(fetchSaavn('/songs', {}, undefined, { fetcher }), /could not be reached/);
  assert.equal(calls, 2);
});

test('search reports a failed song lookup instead of an empty successful result', async () => {
  const fetcher = async (url) => url.includes('/search/songs')
    ? { ok: false, status: 429 }
    : { ok: true, json: async () => ({ success: true, data: { results: [] } }) };
  await assert.rejects(searchSaavn('song', undefined, {}, { fetcher }), /HTTP 429/);
});

test('builds ordered mood playlist queries per language', () => {
  assert.deepEqual(moodPlaylistQueries({ mood: 'romantic', intent: 'match', language: 'Hindi' }), [['hindi romantic', 'hindi love', 'hindi hits']]);
  assert.deepEqual(moodPlaylistQueries({ mood: 'sad', intent: 'uplift', language: 'Punjabi' })[0].slice(0, 2), ['punjabi happy', 'punjabi party']);
  assert.equal(moodPlaylistQueries({ mood: 'calm', language: 'Instrumental' })[0][0], 'instrumental chill');
  assert.equal(moodPlaylistQueries({ mood: 'happy', language: 'Surprise' }).length, 2);
  assert.deepEqual(moodPlaylistQueries({ mood: 'romantic', language: 'All' }).map((queries) => queries[0]), ['hindi romantic', 'english romantic', 'punjabi romantic', 'gujarati romantic']);
});

test('mood mix stops searching alternative playlists once each language has songs', async () => {
  const { fetcher, calls } = fakeFetcher([
    [(path) => path === '/search/playlists', (params) => {
      const language = params.get('query').split(' ')[0];
      return { results: [{ id: language, name: `${language} mix`, language, url: `https://jiosaavn.com/featured/${language}` }] };
    }],
    [(path) => path === '/playlists', (params) => {
      const language = params.get('link').split('/').pop();
      return { songs: Array.from({ length: 8 }, (_, i) => raw(`${language}${i}`, `${language} ${i}`, `Artist ${i}`, { language })) };
    }],
  ]);
  const mix = await fetchSaavnMoodMix({ mood: 'happy', language: 'All' }, 0, undefined, { fetcher });
  assert.equal(mix.length, 12);
  assert.equal(calls.filter((url) => url.includes('/search/playlists')).length, 4);
  assert.equal(calls.filter((url) => new URL(url).pathname === '/api/playlists').length, 4);
});

test('mood mix skips empty and other-language playlists and falls back to other words', async () => {
  const songs = (prefix) => Array.from({ length: 10 }, (_, i) => raw(`${prefix}${i}`, `${prefix} Song ${i}`, `${prefix} Artist ${i}`, { language: 'gujarati' }));
  const { fetcher } = fakeFetcher([
    [(path, params) => path === '/search/playlists' && params.get('query') === 'gujarati chill', () => ({ results: [] })],
    [(path, params) => path === '/search/playlists' && params.get('query') === 'gujarati lofi', () => ({ results: [{ id: 'h', name: 'Lofi Hindi', language: 'hindi', url: 'https://jiosaavn.com/featured/h' }] })],
    [(path) => path === '/search/playlists', () => ({ results: [
      { id: 'e', name: 'Empty - Gujarati', language: 'gujarati', url: 'https://jiosaavn.com/featured/e' },
      { id: 'g1', name: 'Gujarati Superhits', language: 'gujarati', url: 'https://jiosaavn.com/featured/g1' },
      { id: 'g2', name: 'Romantic Hits - Gujarati', language: 'gujarati', url: 'https://jiosaavn.com/featured/g2' },
    ] })],
    [(path) => path === '/playlists', (params) => ({ songs: params.get('link').endsWith('/e') ? [] : songs(params.get('link').slice(-2)) })],
  ]);
  const mix = await fetchSaavnMoodMix({ mood: 'calm', intent: 'match', language: 'Gujarati' }, 0, undefined, { fetcher });
  assert.equal(mix.length, 12);
  assert.ok(mix.every((song) => song.language === 'Gujarati'));
  assert.ok(mix.every((song) => !song.baseReason.includes('Hindi')));
});

test('mood mix tops up near-empty playlists with a same-language song search', async () => {
  const { fetcher, calls } = fakeFetcher([
    [(path) => path === '/search/playlists', () => ({ results: [{ id: 'e', name: 'English 1980s', language: 'english', url: 'https://jiosaavn.com/featured/e' }] })],
    [(path) => path === '/playlists', () => ({ songs: [raw('odd', 'Udi Baba', 'Asha Bhosle', { language: 'english' })] })],
    [(path) => path === '/search/songs', () => ({ results: [
      ...Array.from({ length: 14 }, (_, i) => raw(`en${i}`, `Calm Song ${i}`, `Singer ${i}`, { language: 'english', playCount: i })),
      raw('hi', 'Hindi Song', 'Someone', { language: 'hindi', playCount: 999 }),
    ] })],
  ]);
  const mix = await fetchSaavnMoodMix({ mood: 'calm', intent: 'match', language: 'English' }, 0, undefined, { fetcher });
  assert.equal(mix.length, 12);
  assert.ok(mix.every((song) => song.language === 'English'));
  assert.ok(calls.some((url) => url.includes('/search/songs') && url.includes('english')));
  assert.equal(mix.find((song) => song.saavnId.startsWith('en')).saavnId, 'en13');
});

test('mood mix fills 12 full songs from mood playlists and rotates on refresh', async () => {
  const playlistSongs = (prefix) => Array.from({ length: 15 }, (_, i) => raw(`${prefix}${i}`, `${prefix} Song ${i}`, `${prefix} Artist ${i}`));
  const { fetcher, calls } = fakeFetcher([
    [(path) => path === '/search/playlists', () => ({ results: [{ id: '1', name: 'Romantic Hits', language: 'hindi', url: 'https://jiosaavn.com/featured/a' }, { id: '2', name: '2000s Romantic', language: 'hindi', url: 'https://jiosaavn.com/featured/b' }] })],
    [(path) => path === '/playlists', (params) => ({ songs: playlistSongs(params.get('link').endsWith('/a') ? 'A' : 'B') })],
  ]);
  const first = await fetchSaavnMoodMix({ mood: 'romantic', intent: 'match', language: 'Hindi' }, 0, undefined, { fetcher });
  assert.equal(first.length, 12);
  assert.ok(first.every((song) => song.fullTrack && song.resolvedAudioUrl));
  assert.match(first[0].baseReason, /Romantic Hits/);
  assert.ok(calls.some((url) => url.includes('query=hindi+romantic')));
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
    [(path) => path === '/search/playlists', () => ({ results: [{ id: 'p', name: 'Romantic Hits', language: 'hindi', url: 'https://jiosaavn.com/featured/p' }] })],
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
