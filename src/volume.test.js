import test from 'node:test';
import assert from 'node:assert/strict';
import { canSetVolume, clampVolume, DEFAULT_VOLUME, readVolume, saveVolume, setLevel, toGain, toggleMute, VOLUME_KEY, volumeLevel } from './volume.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = value; }, data };
}

test('clampVolume keeps values within 0..1 and handles junk', () => {
  assert.equal(clampVolume(1.4), 1);
  assert.equal(clampVolume(-2), 0);
  assert.equal(clampVolume(0.333), 0.33);
  assert.equal(clampVolume('nope'), DEFAULT_VOLUME);
});

test('toGain uses a perceptual curve', () => {
  assert.equal(toGain(1), 1);
  assert.equal(toGain(0.5), 0.25);
});

test('volumeLevel picks the icon tier', () => {
  assert.equal(volumeLevel(0.8, true), 'muted');
  assert.equal(volumeLevel(0, false), 'muted');
  assert.equal(volumeLevel(0.2, false), 'low');
  assert.equal(volumeLevel(0.5, false), 'medium');
  assert.equal(volumeLevel(0.9, false), 'high');
});

test('readVolume falls back to defaults and survives bad storage', () => {
  assert.deepEqual(readVolume(memoryStorage()), { level: DEFAULT_VOLUME, muted: false, lastAudible: DEFAULT_VOLUME });
  assert.equal(readVolume(memoryStorage({ [VOLUME_KEY]: '{bad' })).level, DEFAULT_VOLUME);
});

test('saveVolume round-trips through readVolume', () => {
  const storage = memoryStorage();
  saveVolume({ level: 0.4, muted: true, lastAudible: 0.4 }, storage);
  assert.deepEqual(readVolume(storage), { level: 0.4, muted: true, lastAudible: 0.4 });
});

test('dragging to zero mutes and dragging up unmutes', () => {
  const start = { level: 0.6, muted: false, lastAudible: 0.6 };
  const silent = setLevel(start, 0);
  assert.deepEqual(silent, { level: 0, muted: true, lastAudible: 0.6 });
  assert.deepEqual(setLevel({ ...start, muted: true }, 0.3), { level: 0.3, muted: false, lastAudible: 0.3 });
});

test('toggleMute restores the last audible level', () => {
  const muted = toggleMute({ level: 0.7, muted: false, lastAudible: 0.7 });
  assert.equal(muted.muted, true);
  assert.deepEqual(toggleMute(muted), { level: 0.7, muted: false, lastAudible: 0.7 });
  assert.deepEqual(toggleMute({ level: 0, muted: true, lastAudible: 0.45 }), { level: 0.45, muted: false, lastAudible: 0.45 });
});

test('canSetVolume detects browsers that ignore volume (iOS)', () => {
  assert.equal(canSetVolume(() => ({ volume: 1 })), true);
  const locked = { get volume() { return 1; }, set volume(_) {} };
  assert.equal(canSetVolume(() => locked), false);
});
