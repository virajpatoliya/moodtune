import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryMix, buildRelatedMix, buildTasteMix, discoveryQueries, normalizeTracks, relatedQueries, searchMusic, upcomingTracks } from './musicDiscovery.js';

test('discovery queries respond to mood, intent, language, and refresh', () => {
  const base = discoveryQueries('calm', 'match', 'Hindi');
  assert.ok(base.every((query) => query.startsWith('Hindi ')));
  assert.notDeepEqual(base, discoveryQueries('happy', 'match', 'Hindi'));
  assert.notDeepEqual(base, discoveryQueries('calm', 'energetic', 'Hindi'));
  assert.notDeepEqual(base, discoveryQueries('calm', 'match', 'English'));
  assert.notDeepEqual(base, discoveryQueries('calm', 'match', 'Hindi', 1));
  assert.ok(discoveryQueries('calm', 'relax', 'Instrumental').every((query) => query.startsWith('instrumental ')));
  assert.ok(discoveryQueries('calm', 'relax', 'Surprise').every((query) => !query.includes('Surprise')));
});

test('normalization deduplicates and includes only preview-ready tracks without invented audio metrics', () => {
  const track = { trackId: 1, trackName: 'Test song', artistName: 'Artist', previewUrl: 'https://example.com/preview', artworkUrl100: 'https://example.com/100x100bb.jpg' };
  const songs = normalizeTracks([track, track, { trackId: 2, trackName: 'No preview' }], { mood: 'happy', intent: 'match', language: 'Hindi' });
  assert.equal(songs.length, 1);
  assert.equal(songs[0].id, 'itunes-1');
  assert.deepEqual(songs[0].moods, ['happy']);
  assert.equal(songs[0].language, 'Hindi');
  assert.equal(songs[0].bpm, undefined);
  assert.equal(songs[0].energy, undefined);
  assert.ok(songs[0].realCoverUrl.includes('480x480bb'));
});

test('search encodes input and forwards cancellation', async (t) => {
  const signal = new AbortController().signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(new URL(url).searchParams.get('term'), 'love & peace');
    assert.equal(options.signal, signal);
    return { ok: true, json: async () => ({ results: [{ trackId: 1 }] }) };
  });
  assert.deepEqual(await searchMusic('love & peace', signal), [{ trackId: 1 }]);
});

test('discovery balances query sources and prioritizes artist variety without dropping tracks', () => {
  const track = (id, artist) => ({ trackId: id, trackName: `Song ${id}`, artistName: artist, previewUrl: 'https://example.com/preview' });
  const songs = buildDiscoveryMix([
    [track(1, 'Artist A'), track(2, 'Artist A'), track(3, 'Artist B')],
    [track(4, 'Artist C'), track(5, 'Artist D')],
  ], { mood: 'calm', intent: 'relax' });
  assert.deepEqual(songs.map((song) => song.id), ['itunes-1', 'itunes-4', 'itunes-5', 'itunes-3', 'itunes-2']);
  assert.equal(new Set(songs.slice(0, 4).map((song) => song.artist)).size, 4);
  const duplicates = normalizeTracks([track(1, 'Artist A'), { ...track(1, 'Artist A'), trackId: 99 }], { mood: 'calm', intent: 'relax' });
  assert.equal(duplicates.length, 1);
  const covers = buildDiscoveryMix([[
    track(1, 'Artist A'),
    { ...track(2, 'Artist B'), trackName: 'Song 1 (Acoustic)' },
    track(3, 'Artist C'),
  ]], { mood: 'calm', intent: 'relax' });
  assert.deepEqual(covers.map((song) => song.id), ['itunes-1', 'itunes-3', 'itunes-2']);
  assert.deepEqual(buildDiscoveryMix([], { mood: 'calm', intent: 'relax' }), []);
});

test('search surfaces HTTP and malformed-response errors', async (t) => {
  const mock = t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 429 }));
  await assert.rejects(searchMusic('test'), /HTTP 429/);
  mock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({}) }));
  await assert.rejects(searchMusic('test'), /invalid response/);
});

test('song radio follows current-song metadata instead of mood or search history', () => {
  const seed = { id: 'itunes-1', title: 'Seed', artist: 'Artist A', genre: 'Indian Pop' };
  const queries = relatedQueries(seed, 'calm', 'match', 'Hindi');
  assert.equal(queries[0], 'Artist A');
  assert.equal(queries[1], 'Artist A Indian Pop');
  assert.deepEqual(queries, relatedQueries(seed, 'happy', 'match', 'Hindi'));
  assert.deepEqual(queries, relatedQueries(seed, 'calm', 'match', 'English'));
  assert.deepEqual(relatedQueries({ ...seed, genre: null }), ['Artist A']);
});

test('song radio excludes the seed and alternate recordings, deduplicates, and retains genre', () => {
  const track = (id, title, artist) => ({
    trackId: id, trackName: title, artistName: artist,
    primaryGenreName: 'Pop', previewUrl: `https://example.com/${id}`,
  });
  const seed = { id: 'itunes-1', title: 'Seed', artist: 'Artist A' };
  const a = track(2, 'Other song', 'Artist A');
  const b = track(3, 'Another song', 'Artist A');
  const songs = buildRelatedMix([
    [track(1, 'Seed', 'Artist A'), a, track(4, 'Seed (Acoustic)', 'Artist C')],
    [b, a, { trackId: 5, trackName: 'No preview' }],
  ], seed, { mood: 'calm', intent: 'match' });
  assert.deepEqual(new Set(songs.map((song) => song.id)), new Set(['itunes-2', 'itunes-3']));
  assert.ok(songs.every((song) => song.genre === 'Pop' && song.language === 'Global' && song.matchWhy.includes('Seed')));
  assert.deepEqual(buildRelatedMix([], seed, { mood: 'calm', intent: 'match' }), []);
});

test('Garba radio excludes unrelated songs, even by the same artist or broad genre', () => {
  const seed = { id: 'itunes-1', title: 'Navratri Garba', artist: 'Singer', album: 'Garba Hits', genre: 'Indian Pop' };
  const track = (id, title, album, artist = 'Singer') => ({
    trackId: id, trackName: title, collectionName: album, artistName: artist,
    primaryGenreName: 'Indian Pop', previewUrl: `https://example.com/${id}`,
  });
  assert.deepEqual(relatedQueries(seed), ['Singer garba dandiya', 'garba dandiya']);
  const songs = buildRelatedMix([[
    track(2, 'Love Song', 'Romantic Hits'),
    track(3, 'Dholida', 'Nonstop Garba'),
    track(4, 'Dandiya Nights', 'Dance', 'Another Singer'),
    track(5, 'Bhajan', 'Devotional'),
    track(6, 'ગરબો', 'Gujarati', 'Gujarati Singer'),
  ]], seed, {});
  assert.deepEqual(new Set(songs.map((song) => song.id)), new Set(['itunes-3', 'itunes-4', 'itunes-6']));
  assert.ok(songs.every((song) => song.matchWhy.includes('Garba / Dandiya')));
  assert.deepEqual(buildRelatedMix([[track(2, 'Love Song', 'Romantic Hits')]], seed, {}), []);
});

test('generic radio requires a shared artist and matching genre when available', () => {
  const seed = { id: 'itunes-1', title: 'Seed', artist: 'Artist A & Artist B', genre: 'Pop' };
  const track = (id, artist, genre) => ({
    trackId: id, trackName: `Song ${id}`, artistName: artist, primaryGenreName: genre,
    previewUrl: `https://example.com/${id}`,
  });
  const songs = buildRelatedMix([[
    track(2, 'Artist A', 'Pop'),
    track(3, 'Artist B, Artist C', 'Pop'),
    track(4, 'Artist ABC', 'Pop'),
    track(5, 'Artist A', 'Devotional'),
    track(6, 'Unrelated Artist', 'Pop'),
  ]], seed, {});
  assert.deepEqual(songs.map((song) => song.id), ['itunes-2', 'itunes-3']);
});

test('visible upcoming queue matches playback order, wraps, and never repeats the current track', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(upcomingTracks(tracks, 'b'), [{ id: 'c' }, { id: 'a' }]);
  assert.deepEqual(upcomingTracks(tracks, 'c'), [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(upcomingTracks(tracks, 'not-in-pool'), tracks);
  assert.deepEqual(upcomingTracks([{ id: 'a' }], 'a'), []);
  assert.deepEqual(upcomingTracks([], 'a'), []);
});

test('taste suggestions blend search sources, deduplicate, and include the actual search reason', () => {
  const track = (id) => ({ trackId: id, trackName: `Song ${id}`, artistName: `Artist ${id}`, previewUrl: `https://example.com/${id}` });
  const groups = [[track(1), track(2), track(3)], [track(4), track(1), track(5)], [track(6), track(7), track(8)]];
  const terms = ['Ilahi', 'Kasoor', 'Arijit Singh'];
  const songs = buildTasteMix(groups, terms);
  assert.equal(songs.length, 6);
  assert.equal(new Set(songs.map((song) => song.id)).size, 6);
  assert.deepEqual(songs.slice(0, 3).map((song) => song.searchTerm), terms);
  assert.ok(songs.every((song) => song.matchWhy.includes(song.searchTerm) && song.language === 'Global'));
  assert.notDeepEqual(songs.map((song) => song.id), buildTasteMix(groups, terms, 1).map((song) => song.id));
  assert.deepEqual(buildTasteMix([[], [], []], terms), []);
  assert.deepEqual(buildTasteMix([], []), []);
});
