// Player settings, persisted in localStorage. Storage can be
// missing or throw (private mode, blocked cookies), so every access is guarded
// and the game always falls back to defaults.

export const SETTINGS_KEY = 'skyshard.settings';

export const QUALITY_LEVELS = ['low', 'medium', 'high'];

export const DEFAULT_SETTINGS = Object.freeze({
  master: 0.8,
  music: 0.6,
  sfx: 0.9,
  sensitivity: 1,
  invertY: false,
  quality: 'high',
  showFps: false,
});

function num(v, min, max, fallback) {
  const n = Number(v);
  if (v === null || v === '' || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const d = DEFAULT_SETTINGS;
  return {
    master: num(s.master, 0, 1, d.master),
    music: num(s.music, 0, 1, d.music),
    sfx: num(s.sfx, 0, 1, d.sfx),
    sensitivity: num(s.sensitivity, 0.2, 3, d.sensitivity),
    invertY: typeof s.invertY === 'boolean' ? s.invertY : d.invertY,
    quality: QUALITY_LEVELS.includes(s.quality) ? s.quality : d.quality,
    showFps: typeof s.showFps === 'boolean' ? s.showFps : d.showFps,
  };
}

// Phones and low-power devices start on a lighter quality preset.
export function defaultQualityFor(env = globalThis) {
  try {
    const coarse = env.matchMedia?.('(pointer: coarse)')?.matches;
    const cores = env.navigator?.hardwareConcurrency ?? 8;
    if (coarse || cores <= 2) return 'low';
    if (cores <= 4) return 'medium';
  } catch {
    // fall through
  }
  return 'high';
}

function read(storage, key) {
  try {
    const text = storage?.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(storage, env) {
  const stored = read(storage, SETTINGS_KEY);
  if (!stored) return sanitizeSettings({ quality: defaultQualityFor(env) });
  return sanitizeSettings(stored);
}

export function saveSettings(storage, settings) {
  return write(storage, SETTINGS_KEY, sanitizeSettings(settings));
}

export function formatTime(ms) {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  const totalCs = Math.floor(safe / 10);
  const cs = totalCs % 100;
  const totalS = Math.floor(totalCs / 100);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
