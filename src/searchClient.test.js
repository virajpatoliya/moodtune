import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTO_PER_WINDOW, createSearchClient, MAX_CONCURRENT, MAX_PER_WINDOW, MIN_GAP_MS, PRIORITY, RateLimitError, SEARCH_BUDGET_KEY, SEARCH_CACHE_KEY, WINDOW_MS } from './searchClient.js';

function harness({ status = 200 } = {}) {
  let time = 1_000_000;
  const timers = [];
  const calls = [];
  const store = new Map();
  const state = { status };
  const client = createSearchClient({
    now: () => time,
    setTimer: (fn, delay) => {
      const timer = { fn, at: time + delay };
      timers.push(timer);
      return timer;
    },
    clearTimer: (timer) => {
      const index = timers.indexOf(timer);
      if (index >= 0) timers.splice(index, 1);
    },
    storage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) },
    fetchImpl: async (url) => {
      const term = new URL(url).searchParams.get('term');
      calls.push(term);
      return {
        ok: state.status === 200,
        status: state.status,
        json: async () => ({ results: [{ trackId: calls.length, trackName: term, artistName: 'A', previewUrl: 'p', extra: 'dropped' }] }),
      };
    },
  });
  const flush = () => new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  async function advance(ms) {
    time += ms;
    for (const timer of timers.filter((entry) => entry.at <= time)) {
      timers.splice(timers.indexOf(timer), 1);
      timer.fn();
    }
    await flush();
  }
  return { client, calls, store, state, flush, advance };
}

test('identical searches share one request and later reads use the saved cache', async () => {
  const { client, calls, store } = harness();
  const [a, b] = await Promise.all([client.search('Garba'), client.search('  garba ')]);
  assert.equal(calls.length, 1);
  assert.deepEqual(a, b);
  assert.equal(a[0].extra, undefined);
  assert.ok(store.get(SEARCH_CACHE_KEY).includes('garba'));
  await client.search('GARBA');
  assert.equal(calls.length, 1);
});

test('requests are paced and beyond the per-minute budget they wait instead of hitting the API', async () => {
  const { client, calls, advance } = harness();
  const pending = Array.from({ length: AUTO_PER_WINDOW + 2 }, (_, index) => client.search(`song ${index}`));
  await advance(0);
  assert.equal(calls.length, 1);
  for (let step = 0; step < MAX_PER_WINDOW + 10; step += 1) await advance(MIN_GAP_MS);
  assert.equal(calls.length, AUTO_PER_WINDOW);
  const typed = client.search('typed now', { priority: PRIORITY.search });
  await advance(MIN_GAP_MS);
  assert.equal((await typed)[0].trackName, 'typed now');
  await advance(WINDOW_MS);
  for (let step = 0; step < 5; step += 1) await advance(MIN_GAP_MS);
  for (let step = 0; step < 5; step += 1) await advance(MIN_GAP_MS);
  await Promise.all(pending);
  assert.equal(calls.length, AUTO_PER_WINDOW + 3);
});

test('user searches jump ahead of queued background searches', async () => {
  const { client, calls, advance } = harness();
  const background = Array.from({ length: 6 }, (_, index) => client.search(`bg ${index}`, { priority: PRIORITY.background }));
  const mine = client.search('kesariya', { priority: PRIORITY.search });
  for (let step = 0; step < 10; step += 1) await advance(MIN_GAP_MS);
  await mine;
  assert.ok(calls.indexOf('kesariya') <= MAX_CONCURRENT);
  for (let step = 0; step < 20; step += 1) await advance(MIN_GAP_MS);
  await Promise.all(background);
});

test('a random 403 is retried instead of failing the section', async () => {
  const { client, calls, state, advance } = harness({ status: 403 });
  const pending = client.search('garba');
  await advance(0);
  state.status = 200;
  for (let step = 0; step < 20; step += 1) await advance(200);
  assert.equal((await pending)[0].trackName, 'garba');
  assert.equal(calls.length, 2);
  assert.equal(client.cooldownRemaining(), 0);
});

test('repeated 403s pause background searches, use saved songs, and still let typed searches try', async () => {
  const { client, calls, state, advance } = harness();
  await client.search('ilahi');
  await advance(7 * 60 * 60 * 1000);
  state.status = 403;
  const pending = [client.search('ilahi'), client.search('new song')];
  pending.forEach((promise) => promise.catch(() => {}));
  for (let step = 0; step < 100; step += 1) await advance(200);
  assert.equal((await pending[0])[0].trackName, 'ilahi');
  await assert.rejects(pending[1], (error) => error instanceof RateLimitError && !/HTTP 403/.test(error.message));
  assert.ok(client.cooldownRemaining() > 0);
  const before = calls.length;
  await assert.rejects(client.search('other'), RateLimitError);
  assert.equal(calls.length, before);
  state.status = 200;
  const typed = client.search('typed', { priority: PRIORITY.search });
  await advance(MIN_GAP_MS);
  assert.equal((await typed)[0].trackName, 'typed');
  assert.equal(client.cooldownRemaining(), 0);
});

test('an aborted caller does not cancel the shared request for others', async () => {
  const { client } = harness();
  const controller = new AbortController();
  const first = client.search('bhajan', { signal: controller.signal });
  const second = client.search('bhajan');
  controller.abort(new Error('left'));
  await assert.rejects(first, /left/);
  assert.equal((await second)[0].trackName, 'bhajan');
});

test('the request budget survives a reload', async () => {
  const { client, store, advance } = harness();
  await Promise.all([client.search('a'), client.search('b'), (async () => { await advance(MIN_GAP_MS); })()]);
  const budget = JSON.parse(store.get(SEARCH_BUDGET_KEY));
  assert.equal(budget.sent.length, 2);
});
