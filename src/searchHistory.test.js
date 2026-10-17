import test from 'node:test';
import assert from 'node:assert/strict';
import { addSearchTerm, readSearchHistory, SEARCH_HISTORY_KEY } from './searchHistory.js';

test('history trims, deduplicates without case sensitivity, and moves recent terms first', () => {
  assert.deepEqual(addSearchTerm(['Kasoor', 'Ilahi'], '  ILAHI  '), ['ILAHI', 'Kasoor']);
  assert.deepEqual(addSearchTerm([], ' Arijit   Singh '), ['Arijit Singh']);
  assert.deepEqual(addSearchTerm(['Ilahi'], ' '), ['Ilahi']);
  assert.equal(addSearchTerm([], 'a'.repeat(300))[0].length, 200);
});

test('history retains exactly the last ten searches', () => {
  let history = [];
  for (let index = 0; index < 15; index++) history = addSearchTerm(history, `Song ${index}`);
  assert.equal(history.length, 10);
  assert.equal(history[0], 'Song 14');
  assert.equal(history[9], 'Song 5');
});

test('history restores stored order and safely normalizes old values', () => {
  assert.deepEqual(readSearchHistory({ getItem: (key) => {
    assert.equal(key, SEARCH_HISTORY_KEY);
    return '["Ilahi","Kasoor","ilahi"]';
  } }), ['Ilahi', 'Kasoor']);
  assert.deepEqual(readSearchHistory({ getItem: () => null }), []);
});

test('invalid or blocked storage surfaces errors', () => {
  for (const raw of ['{', '{}', 'null', '[1]', '[""]']) {
    assert.throws(() => readSearchHistory({ getItem: () => raw }));
  }
  assert.throws(() => readSearchHistory({ getItem: () => { throw new Error('Blocked'); } }), /Blocked/);
});
