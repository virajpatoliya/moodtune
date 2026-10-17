import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoveryMix, discoveryQueries, normalizeTracks, searchMusic } from './musicDiscovery.js';

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
