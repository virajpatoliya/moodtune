import assert from 'node:assert/strict';
import test from 'node:test';
import { vibeTheme } from './vibeTheme.js';

test('vibe theme follows song style before anything else', () => {
  assert.equal(vibeTheme({ title: 'Navratri Garba Mashup', genre: 'Dance', moods: ['sad'] }).motion, 'swirl');
  assert.equal(vibeTheme({ title: 'Morning Bhajan', genre: 'Devotional' }).id, 'bhajan');
  assert.equal(vibeTheme({ title: 'Lo-fi Nights', genre: 'Pop' }).id, 'lofi');
});

test('vibe theme uses song mood, then genre, then the listener mood', () => {
  assert.deepEqual([vibeTheme({ title: 'Rainy', moods: ['sad'] }).motion, vibeTheme({ title: 'Rainy', moods: ['sad'] }).source], ['rain', 'mood']);
  assert.deepEqual([vibeTheme({ title: 'Club', genre: 'Electronic' }).id, vibeTheme({ title: 'Club', genre: 'Electronic' }).source], ['neon', 'genre']);
  assert.equal(vibeTheme({ title: 'Song', genre: 'Pop' }, 'stressed').motion, 'breathe');
  assert.equal(vibeTheme(null, 'unknown').id, 'golden');
});
