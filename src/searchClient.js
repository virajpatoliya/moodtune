// Apple's iTunes Search API allows roughly 20 calls per minute per IP and also rejects
// bursts and some individual requests at random with 403/429. Every search goes through
// one shared scheduler that paces requests and retries rejected ones.
export const SEARCH_CACHE_KEY = 'moodtune.searchCache.v1';
export const FRESH_MS = 6 * 60 * 60 * 1000;
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_CACHE_ENTRIES = 160;
export const WINDOW_MS = 60 * 1000;
export const MAX_PER_WINDOW = 20;
// Automatic sections leave room in every minute for searches the user types.
export const AUTO_PER_WINDOW = 15;
export const SEARCH_BUDGET_KEY = 'moodtune.searchBudget.v2';
export const MAX_CONCURRENT = 2;
export const MIN_GAP_MS = 1000;
export const MAX_ATTEMPTS = 4;
export const RETRY_BASE_MS = 1200;
export const STRIKES_BEFORE_PAUSE = 8;
export const COOLDOWN_MS = 20 * 1000;
export const MAX_COOLDOWN_MS = 2 * 60 * 1000;
export const PRIORITY = { search: 0, radio: 1, discovery: 2, background: 3 };

const KEPT_FIELDS = ['trackId', 'trackName', 'artistName', 'collectionName', 'primaryGenreName', 'previewUrl', 'artworkUrl100', 'releaseDate'];

export class RateLimitError extends Error {
  constructor(retryInMs) {
    const seconds = Math.max(5, Math.ceil(retryInMs / 1000));
    super(`Apple's music search is busy right now. MoodTune will retry in about ${seconds}s.`);
    this.name = 'RateLimitError';
    this.retryInMs = retryInMs;
  }
}

export function searchCacheKey(term) {
  return term.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function compactResults(results) {
  return results.map((item) => Object.fromEntries(KEPT_FIELDS.filter((field) => item[field] !== undefined).map((field) => [field, item[field]])));
}

function abortReason(signal) {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
}

export function createSearchClient({
  fetchImpl = (...args) => globalThis.fetch(...args),
  storage = globalThis.localStorage,
  now = Date.now,
  setTimer = (...args) => globalThis.setTimeout(...args),
  clearTimer = (...args) => globalThis.clearTimeout(...args),
  requestTimeoutMs = 12000,
} = {}) {
  let cache = null;
  const inflight = new Map();
  const queue = [];
  let sent = [];
  let active = 0;
  let sequence = 0;
  let cooldownUntil = 0;
  let cooldownMs = COOLDOWN_MS;
  let strikes = 0;
  let wakeTimer = null;
  let wakeAt = Infinity;
  let lastStart = 0;

  // The budget survives reloads so refreshing the page cannot burst past Apple's limit.
  try {
    const budget = JSON.parse(storage?.getItem(SEARCH_BUDGET_KEY) || '{}');
    if (Array.isArray(budget.sent)) sent = budget.sent.filter((stamp) => Number.isFinite(stamp) && now() - stamp < WINDOW_MS);
    if (Number.isFinite(budget.cooldownUntil)) cooldownUntil = budget.cooldownUntil;
    if (Number.isFinite(budget.cooldownMs)) cooldownMs = Math.min(Math.max(budget.cooldownMs, COOLDOWN_MS), MAX_COOLDOWN_MS);
  } catch (error) {
    console.warn('Saved search budget could not be read.', error);
  }

  function saveBudget() {
    try {
      storage?.setItem(SEARCH_BUDGET_KEY, JSON.stringify({ sent, cooldownUntil, cooldownMs }));
    } catch { /* budget stays in memory */ }
  }

  function loadCache() {
    if (cache) return cache;
    cache = new Map();
    try {
      const stored = JSON.parse(storage?.getItem(SEARCH_CACHE_KEY) || '[]');
      for (const [key, entry] of stored) {
        if (entry && Array.isArray(entry.results) && now() - entry.savedAt < STALE_MS) cache.set(key, entry);
      }
    } catch (error) {
      console.warn('Saved music searches could not be read.', error);
    }
    return cache;
  }

  function saveCache() {
    try {
      storage?.setItem(SEARCH_CACHE_KEY, JSON.stringify([...cache]));
    } catch (error) {
      // Quota errors only cost us persistence; drop the oldest half and retry once.
      console.warn('Saved music searches could not be stored.', error);
      const keys = [...cache.keys()];
      keys.slice(0, Math.ceil(keys.length / 2)).forEach((key) => cache.delete(key));
      try { storage?.setItem(SEARCH_CACHE_KEY, JSON.stringify([...cache])); } catch { /* keep in memory only */ }
    }
  }

  function remember(key, results) {
    const entries = loadCache();
    entries.delete(key);
    entries.set(key, { savedAt: now(), results });
    while (entries.size > MAX_CACHE_ENTRIES) entries.delete(entries.keys().next().value);
    saveCache();
  }

  function schedule(delay) {
    const at = now() + Math.max(0, delay);
    if (wakeTimer !== null && wakeAt <= at) return;
    if (wakeTimer !== null) clearTimer(wakeTimer);
    wakeAt = at;
    wakeTimer = setTimer(() => {
      wakeTimer = null;
      wakeAt = Infinity;
      pump();
    }, Math.max(0, delay));
  }

  function settleFromCache(job, error) {
    queue.splice(queue.indexOf(job), 1);
    inflight.delete(job.key);
    const stale = loadCache().get(job.key);
    if (stale) job.succeed(stale.results);
    else job.fail(error);
  }

  function pump() {
    while (queue.length && active < MAX_CONCURRENT) {
      const time = now();
      sent = sent.filter((stamp) => time - stamp < WINDOW_MS);
      const abandoned = queue.find((job) => !job.waiters.size);
      if (abandoned) {
        queue.splice(queue.indexOf(abandoned), 1);
        inflight.delete(abandoned.key);
        continue;
      }
      // Typed searches may still try during a pause; background work waits or uses saved songs.
      const paused = time < cooldownUntil;
      const blocked = paused && queue.find((job) => job.priority !== PRIORITY.search);
      if (blocked) {
        settleFromCache(blocked, new RateLimitError(cooldownUntil - time));
        continue;
      }
      const limitFor = (entry) => entry.priority === PRIORITY.search ? MAX_PER_WINDOW : AUTO_PER_WINDOW;
      const job = queue.find((entry) => entry.notBefore <= time && sent.length < limitFor(entry));
      if (!job) {
        const ready = queue.filter((entry) => entry.notBefore <= time);
        const nextRetry = Math.min(...queue.filter((entry) => entry.notBefore > time).map((entry) => entry.notBefore));
        schedule(Math.min(nextRetry, ready.length ? sent[0] + WINDOW_MS : Infinity) - time);
        return;
      }
      if (time - lastStart < MIN_GAP_MS) {
        schedule(lastStart + MIN_GAP_MS - time);
        return;
      }
      queue.splice(queue.indexOf(job), 1);
      active += 1;
      lastStart = time;
      sent.push(time);
      saveBudget();
      run(job).finally(() => {
        active -= 1;
        pump();
      });
    }
  }

  function retryLater(job) {
    job.attempts += 1;
    strikes += 1;
    if (strikes >= STRIKES_BEFORE_PAUSE && now() >= cooldownUntil) {
      cooldownUntil = now() + cooldownMs;
      cooldownMs = Math.min(cooldownMs * 2, MAX_COOLDOWN_MS);
      strikes = 0;
      saveBudget();
    }
    if (job.attempts >= MAX_ATTEMPTS || !job.waiters.size) return false;
    job.notBefore = now() + RETRY_BASE_MS * 2 ** (job.attempts - 1) + Math.floor(Math.random() * 400);
    queue.push(job);
    queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
    return true;
  }

  async function run(job) {
    const controller = new AbortController();
    const timeout = setTimer(() => controller.abort(new Error('Music search timed out. Please retry.')), requestTimeoutMs);
    try {
      const params = new URLSearchParams({ term: job.term, media: 'music', entity: 'song', limit: '30', country: 'IN' });
      const response = await fetchImpl(`https://itunes.apple.com/search?${params}`, { signal: controller.signal });
      if (response.status === 403 || response.status === 429) {
        if (retryLater(job)) return;
        throw new RateLimitError(Math.max(cooldownUntil - now(), COOLDOWN_MS));
      }
      if (!response.ok) throw new Error(`Music search unavailable (HTTP ${response.status}). Please retry.`);
      const data = await response.json();
      if (!Array.isArray(data.results)) throw new Error('Music service returned an invalid response.');
      strikes = 0;
      if (cooldownMs !== COOLDOWN_MS || cooldownUntil) {
        cooldownMs = COOLDOWN_MS;
        cooldownUntil = 0;
        saveBudget();
      }
      const results = compactResults(data.results);
      remember(job.key, results);
      job.succeed(results);
    } catch (error) {
      const stale = loadCache().get(job.key);
      if (stale) job.succeed(stale.results);
      else job.fail(error);
    } finally {
      clearTimer(timeout);
      if (!queue.includes(job)) inflight.delete(job.key);
    }
  }

  function enqueue(key, term, priority) {
    let job = inflight.get(key);
    if (job) {
      if (priority < job.priority && queue.includes(job)) {
        job.priority = priority;
        queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
      }
      return job;
    }
    job = { key, term, priority, order: sequence++, attempts: 0, notBefore: 0, waiters: new Set() };
    job.promise = new Promise((resolve, reject) => {
      job.succeed = resolve;
      job.fail = reject;
    });
    job.promise.catch(() => {});
    inflight.set(key, job);
    queue.push(job);
    queue.sort((a, b) => a.priority - b.priority || a.order - b.order);
    return job;
  }

  function search(term, { signal, priority = PRIORITY.discovery } = {}) {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    const key = searchCacheKey(term);
    const cached = loadCache().get(key);
    if (cached && now() - cached.savedAt < FRESH_MS) return Promise.resolve(cached.results);
    if (now() < cooldownUntil && priority !== PRIORITY.search) {
      return cached ? Promise.resolve(cached.results) : Promise.reject(new RateLimitError(cooldownUntil - now()));
    }
    const job = enqueue(key, term.trim(), priority);
    const waiter = {};
    job.waiters.add(waiter);
    pump();
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        job.waiters.delete(waiter);
        reject(abortReason(signal));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      job.promise.then(resolve, reject).finally(() => {
        job.waiters.delete(waiter);
        signal?.removeEventListener('abort', onAbort);
      });
    });
  }

  return {
    search,
    cooldownRemaining: () => Math.max(0, cooldownUntil - now()),
  };
}
