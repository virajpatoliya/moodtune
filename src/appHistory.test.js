import test from 'node:test';
import assert from 'node:assert/strict';
import { locationKey, planHistoryUpdate } from './appHistory.js';

const at = (screen, extra = {}) => ({ screen, step: 0, search: false, player: false, mood: false, ...extra });

test('new screens, quiz steps, and overlays push history entries', () => {
  assert.equal(planHistoryUpdate([at('welcome')], 0, at('quiz')), 'push');
  assert.equal(planHistoryUpdate([at('welcome'), at('quiz')], 1, at('quiz', { step: 1 })), 'push');
  assert.equal(planHistoryUpdate([at('home')], 0, at('home', { search: true })), 'push');
  assert.equal(planHistoryUpdate([at('home'), at('home', { player: true })], 1, at('home', { player: true, search: true })), 'push');
});

test('closing an overlay or stepping back reuses the previous history entry', () => {
  assert.equal(planHistoryUpdate([at('home'), at('home', { search: true })], 1, at('home')), 'back');
  assert.equal(planHistoryUpdate([at('welcome'), at('quiz'), at('quiz', { step: 1 })], 2, at('quiz')), 'back');
  assert.equal(planHistoryUpdate([at('welcome'), at('quiz')], 1, at('welcome')), 'back');
});

test('swapping a closed overlay for a new place replaces it so Back does not reopen it', () => {
  assert.equal(planHistoryUpdate([at('home'), at('home', { search: true })], 1, at('home', { player: true })), 'replace');
  assert.equal(planHistoryUpdate([at('home'), at('home', { mood: true })], 1, at('quiz')), 'replace');
});

test('transient and unchanged states do not touch history', () => {
  assert.equal(planHistoryUpdate([at('quiz', { step: 2 })], 0, at('analyzing')), 'none');
  assert.equal(planHistoryUpdate([at('home')], 0, at('home')), 'none');
  assert.equal(planHistoryUpdate([], 0, at('home')), 'none');
  assert.equal(locationKey(at('home', { step: 2 })), locationKey(at('home')));
});
