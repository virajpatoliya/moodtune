const THEMES = {
  garba: { label: 'Festive Garba', motion: 'swirl', colors: ['#f97316', '#db2777', '#facc15'], base: '#1a0710' },
  bhajan: { label: 'Devotional Glow', motion: 'glow', colors: ['#f59e0b', '#fb923c', '#fde68a'], base: '#160b02' },
  sufi: { label: 'Sufi Night', motion: 'drift', colors: ['#0d9488', '#ca8a04', '#1e3a8a'], base: '#020b12' },
  lofi: { label: 'Lo-fi Haze', motion: 'drift', colors: ['#a78bfa', '#f0abfc', '#64748b'], base: '#0f0b19' },
  neon: { label: 'Neon Pulse', motion: 'pulse', colors: ['#22d3ee', '#a855f7', '#ec4899'], base: '#05030f' },
  ember: { label: 'Ember', motion: 'pulse', colors: ['#ef4444', '#f97316', '#7f1d1d'], base: '#120404' },
  aurora: { label: 'Aurora Calm', motion: 'drift', colors: ['#34d399', '#38bdf8', '#818cf8'], base: '#03101a' },
  golden: { label: 'Golden Hour', motion: 'spark', colors: ['#fbbf24', '#fb7185', '#f97316'], base: '#170a05' },
  ocean: { label: 'Ocean Drift', motion: 'drift', colors: ['#0ea5e9', '#14b8a6', '#6366f1'], base: '#020c18' },
  rain: { label: 'Midnight Rain', motion: 'rain', colors: ['#6366f1', '#3b82f6', '#94a3b8'], base: '#04060f' },
  breathe: { label: 'Soft Breath', motion: 'breathe', colors: ['#5eead4', '#a5b4fc', '#c4b5fd'], base: '#06101a' },
  rose: { label: 'Rose Dusk', motion: 'glow', colors: ['#f43f5e', '#ec4899', '#a855f7'], base: '#14040c' },
};

const STYLE_RULES = [
  ['garba', /garba|garbo|garbe|dandiya|navratri|ગરબા|ગરબો|गरबा|डांडिया/i],
  ['bhajan', /bhajan|aarti|kirtan|mantra|devotional|ભજન|भजन/i],
  ['sufi', /qawwali|ghazal|sufi|gazal|कव्वाली|ग़ज़ल/i],
  ['lofi', /\blo[\s-]?fi\b/i],
];

const GENRE_RULES = [
  ['neon', /dance|electronic|edm|house|hip[\s-]?hop|rap|punjabi|bhangra/i],
  ['ember', /rock|metal|punk/i],
  ['aurora', /classical|ambient|new age|instrumental|piano|soundtrack/i],
];

const MOOD_THEMES = { happy: 'golden', calm: 'ocean', sad: 'rain', stressed: 'breathe', romantic: 'rose', motivated: 'neon' };

export function vibeTheme(song, fallbackMood = 'happy') {
  const text = `${song?.title || ''} ${song?.album || ''} ${song?.genre || ''}`;
  const style = STYLE_RULES.find(([, pattern]) => pattern.test(text));
  if (style) return { id: style[0], source: 'style', ...THEMES[style[0]] };
  const mood = song?.moods?.find((value) => MOOD_THEMES[value]);
  if (mood) return { id: MOOD_THEMES[mood], source: 'mood', ...THEMES[MOOD_THEMES[mood]] };
  const genre = GENRE_RULES.find(([, pattern]) => pattern.test(song?.genre || ''));
  if (genre) return { id: genre[0], source: 'genre', ...THEMES[genre[0]] };
  const id = MOOD_THEMES[fallbackMood] || 'golden';
  return { id, source: 'mood', ...THEMES[id] };
}

export const VIBE_IDLE_MS = 30000;
