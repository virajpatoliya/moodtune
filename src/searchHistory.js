export const SEARCH_HISTORY_KEY = 'moodtune.search-history.v1';

export function addSearchTerm(history, term) {
  const normalized = term.trim().replace(/\s+/g, ' ').slice(0, 200);
  if (!normalized) return history;
  return [normalized, ...history.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase())].slice(0, 10);
}

export function readSearchHistory(storage) {
  const raw = storage.getItem(SEARCH_HISTORY_KEY);
  if (raw === null) return [];
  const terms = JSON.parse(raw);
  if (!Array.isArray(terms) || terms.some((term) => typeof term !== 'string' || !term.trim())) {
    throw new Error('Invalid search history stored on this device.');
  }
  return terms.reduceRight((history, term) => addSearchTerm(history, term), []);
}
