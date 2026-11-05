// Per-world atmosphere: sky gradient, fog, light colours, clouds and motes.
// A level picks one with `env: 'meadow' | 'ember' | 'starfall'` (or passes an object).
// 'meadow' is the original Driftmeadow look and the default.

export const ENVS = {
  meadow: {
    sky: { zenith: 0x5d97e0, mid: 0x9cc6f0, horizon: 0xf6dccb, below: 0xf2c9c4, sun: 0xfff0da, stars: 0 },
    fog: { color: 0xf6dccb, near: 90, far: 420 },
    hemi: { sky: 0xd6e8ff, ground: 0xe8b894, intensity: 0.85 },
    sun: { color: 0xfff0da, intensity: 2.7 },
    clouds: { color: 0xffffff, emissive: 0xffe7d6, glow: 0.28, hue: 0.07, floor: 0xf7e2d6 },
    motes: 0xffeec0,
    distantThemes: ['meadow', 'crystal', 'spire', 'beacon'],
    exposure: 1.05,
  },
  // Emberwilds: a smouldering dusk over a sea of glowing ash cloud.
  ember: {
    sky: { zenith: 0x2a1a3a, mid: 0x7a3550, horizon: 0xff9a5c, below: 0x5a1f1c, sun: 0xffb27a, stars: 0.15 },
    fog: { color: 0xc8644a, near: 70, far: 360 },
    hemi: { sky: 0xffb08a, ground: 0x6a2a24, intensity: 0.75 },
    sun: { color: 0xffc09a, intensity: 2.4 },
    clouds: { color: 0x6b4048, emissive: 0xff5a2a, glow: 0.45, hue: 0.02, floor: 0x8a2e1e },
    motes: 0xff8a3c,
    distantThemes: ['ember', 'ash', 'ember', 'ash'],
    exposure: 1.1,
  },
  // Starfall Reach: deep night, aurora tint and crisp frost islands.
  starfall: {
    sky: { zenith: 0x070b24, mid: 0x1b2a5c, horizon: 0x5a6fb0, below: 0x16163a, sun: 0xcfe0ff, stars: 1 },
    fog: { color: 0x34407a, near: 70, far: 380 },
    hemi: { sky: 0x8aa4ff, ground: 0x302a5a, intensity: 0.95 },
    sun: { color: 0xc8d8ff, intensity: 2.1 },
    clouds: { color: 0x7a86c8, emissive: 0x6a5cff, glow: 0.35, hue: 0.66, floor: 0x252a5a },
    motes: 0xb8d4ff,
    distantThemes: ['frost', 'starlit', 'frost', 'starlit'],
    exposure: 1.15,
  },
};

export function resolveEnv(env) {
  if (!env) return ENVS.meadow;
  if (typeof env === 'string') return ENVS[env] ?? ENVS.meadow;
  return { ...ENVS.meadow, ...env };
}
