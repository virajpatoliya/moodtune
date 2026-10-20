export const VOLUME_KEY = 'moodtune.volume.v1';
export const DEFAULT_VOLUME = 0.8;
export const VOLUME_STEP = 0.05;
// Restored when unmuting from 0 so the user is never "unmuted" into silence.
export const UNMUTE_FALLBACK = 0.5;

export const MOOD_ACCENTS = {
  happy: ['#f59e0b', '#f43f5e'],
  calm: ['#34d399', '#0d9488'],
  sad: ['#6366f1', '#9333ea'],
  stressed: ['#2dd4bf', '#4f46e5'],
  romantic: ['#f43f5e', '#f59e0b'],
  motivated: ['#22d3ee', '#2563eb'],
};

export function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_VOLUME;
  return Math.round(Math.min(1, Math.max(0, number)) * 100) / 100;
}

// Ears hear loudness roughly logarithmically; squaring makes the slider feel even.
export function toGain(level) {
  return clampVolume(level) ** 2;
}

export function volumeLevel(level, muted) {
  if (muted || level <= 0) return 'muted';
  if (level < 0.34) return 'low';
  if (level < 0.67) return 'medium';
  return 'high';
}

export function readVolume(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(VOLUME_KEY) || 'null');
    if (!saved) return { level: DEFAULT_VOLUME, muted: false, lastAudible: DEFAULT_VOLUME };
    const level = clampVolume(saved.level);
    const lastAudible = clampVolume(saved.lastAudible) || UNMUTE_FALLBACK;
    return { level, muted: Boolean(saved.muted), lastAudible };
  } catch {
    return { level: DEFAULT_VOLUME, muted: false, lastAudible: DEFAULT_VOLUME };
  }
}

export function saveVolume(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(VOLUME_KEY, JSON.stringify(state));
  } catch { /* volume still works for this visit */ }
}

export function setLevel(state, value) {
  const level = clampVolume(value);
  return { level, muted: level === 0, lastAudible: level > 0 ? level : state.lastAudible };
}

export function toggleMute(state) {
  if (state.muted || state.level === 0) {
    const level = state.level > 0 ? state.level : state.lastAudible || UNMUTE_FALLBACK;
    return { level, muted: false, lastAudible: level };
  }
  return { ...state, muted: true };
}

// iOS Safari ignores HTMLMediaElement.volume (hardware buttons only), so detect it.
export function canSetVolume(createAudio = () => new Audio()) {
  try {
    const probe = createAudio();
    probe.volume = 0.5;
    return Math.abs(probe.volume - 0.5) < 0.01;
  } catch {
    return false;
  }
}
