import test from 'node:test';
import assert from 'node:assert/strict';
import { audiusMoodsFor, audiusStreamUrl, buildOpenRadio, interleave, isLikelyRip, normalizeAudiusTracks, openMixRequests } from './openMusic.js';

const track = (id, extra = {}) => ({
  id,
  title: `Song ${id}`,
  duration: 180,
  genre: 'Lo-Fi',
  mood: 'Peaceful',
  permalink: `/artist/song-${id}`,
  artwork: { '480x480': `https://img/${id}.jpg` },
  user: { id: 'u1', name: 'Artist' },
  ...extra,
});

test('normalizeAudiusTracks maps full tracks into the app song shape', () => {
  const [song] = normalizeAudiusTracks([track('abc')], { mood: 'calm', intent: 'match' });
  assert.equal(song.id, 'audius-abc');
  assert.equal(song.source, 'audius');
  assert.equal(song.fullTrack, true);
  assert.equal(song.duration, 180);
  assert.equal(song.resolvedAudioUrl, audiusStreamUrl('abc'));
  assert.equal(song.pageUrl, 'https://audius.co/artist/song-abc');
  assert.equal(song.realCoverUrl, 'https://img/abc.jpg');
  assert.deepEqual(song.moods, ['calm']);
});

test('normalizeAudiusTracks drops gated, unstreamable, duplicate and ripped uploads', () => {
  const songs = normalizeAudiusTracks([
    track('a'),
    track('a'),
    track('b', { title: 'Song a' }),
    track('c', { is_stream_gated: true }),
    track('d', { is_streamable: false }),
    track('e', { title: 'Tum Hi Ho - 320Kbps' }),
    track('g', { duration: 4800 }),
    { id: 'f' },
  ]);
  assert.deepEqual(songs.map((song) => song.id), ['audius-a']);
});

test('isLikelyRip flags common re-upload titles only', () => {
  assert.equal(isLikelyRip('Nashe Si Chadh Gayi - 320Kbps'), true);
  assert.equal(isLikelyRip('Kesariya Full Song'), true);
  assert.equal(isLikelyRip('Wavy Days (LoFi Chill)'), false);
});

test('openMixRequests pages through results on refresh', () => {
  assert.deepEqual(audiusMoodsFor('unknown'), audiusMoodsFor('calm'));
  const first = openMixRequests('happy', 0);
  const next = openMixRequests('happy', 1);
  assert.deepEqual(first.map((r) => r.mood), ['Upbeat', 'Excited']);
  assert.equal(first[0].offset, '0');
  assert.equal(next[0].offset, '20');
  assert.equal(openMixRequests('happy', 5)[0].offset, '0');
});

test('interleave alternates between groups', () => {
  assert.deepEqual(interleave([[1, 3, 5], [2]]), [1, 2, 3, 5]);
});

test('buildOpenRadio prefers artist, then style, then mood, excluding seed and played', () => {
  const [seed, a, b, c, d] = normalizeAudiusTracks(['s', 'a', 'b', 'c', 'd'].map((id) => track(id, { title: id })));
  const queue = buildOpenRadio(seed, { artistTracks: [seed, a], styleTracks: [b, a], moodTracks: [c, d], excludeIds: [d.id] });
  assert.deepEqual(queue.map((song) => song.id), [a.id, b.id, c.id]);
  assert.match(queue[0].matchWhy, /More from Artist/);
});
