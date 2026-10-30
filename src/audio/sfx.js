import { midiToFreq, tone, noise } from './synth.js';

// Every sound is built from oscillators and noise at play time, so the game
// ships with no audio files. `p` is a pitch multiplier for variety.
const RECIPES = {
  jump(ctx, out, nb, t, p) {
    tone(ctx, out, { t, type: 'triangle', f0: 280 * p, f1: 620 * p, dur: 0.16, gain: 0.35 });
    tone(ctx, out, { t, type: 'square', f0: 140 * p, f1: 310 * p, dur: 0.1, gain: 0.06 });
  },
  doubleJump(ctx, out, nb, t, p) {
    tone(ctx, out, { t, type: 'triangle', f0: 520 * p, f1: 980 * p, dur: 0.14, gain: 0.3 });
    tone(ctx, out, { t: t + 0.05, type: 'sine', f0: 1040 * p, f1: 1560 * p, dur: 0.18, gain: 0.18 });
    noise(ctx, out, nb, { t, dur: 0.2, gain: 0.06, filter: 'highpass', f0: 4000, f1: 8000 });
  },
  dash(ctx, out, nb, t) {
    noise(ctx, out, nb, { t, dur: 0.28, gain: 0.4, filter: 'bandpass', f0: 2600, f1: 380, q: 1.4, attack: 0.02 });
    tone(ctx, out, { t, type: 'sine', f0: 220, f1: 110, dur: 0.2, gain: 0.12 });
  },
  land(ctx, out, nb, t) {
    tone(ctx, out, { t, type: 'sine', f0: 150, f1: 60, dur: 0.12, gain: 0.35 });
    noise(ctx, out, nb, { t, dur: 0.08, gain: 0.12, filter: 'lowpass', f0: 900, f1: 200 });
  },
  pound(ctx, out, nb, t) {
    tone(ctx, out, { t, type: 'sine', f0: 110, f1: 32, dur: 0.45, gain: 0.6 });
    tone(ctx, out, { t, type: 'triangle', f0: 70, f1: 30, dur: 0.3, gain: 0.25 });
    noise(ctx, out, nb, { t, dur: 0.35, gain: 0.35, filter: 'lowpass', f0: 1800, f1: 120 });
  },
  shard(ctx, out, nb, t, p) {
    // Rising three-note chime, like glass catching light.
    [76, 80, 83].forEach((m, i) => {
      const f = midiToFreq(m) * p;
      tone(ctx, out, { t: t + i * 0.055, type: 'sine', f0: f, dur: 0.35, gain: 0.22 });
      tone(ctx, out, { t: t + i * 0.055, type: 'triangle', f0: f * 2, dur: 0.18, gain: 0.05 });
    });
  },
  hurt(ctx, out, nb, t) {
    tone(ctx, out, { t, type: 'sawtooth', f0: 420, f1: 110, dur: 0.32, gain: 0.22 });
    tone(ctx, out, { t, type: 'square', f0: 300, f1: 90, dur: 0.25, gain: 0.08, detune: 30 });
    noise(ctx, out, nb, { t, dur: 0.12, gain: 0.15, filter: 'bandpass', f0: 1200, q: 2 });
  },
  enemyDefeat(ctx, out, nb, t) {
    tone(ctx, out, { t, type: 'square', f0: 880, f1: 180, dur: 0.22, gain: 0.12 });
    noise(ctx, out, nb, { t, dur: 0.18, gain: 0.25, filter: 'bandpass', f0: 3000, f1: 500, q: 1.2 });
    tone(ctx, out, { t: t + 0.12, type: 'triangle', f0: midiToFreq(84), dur: 0.2, gain: 0.15 });
  },
  checkpoint(ctx, out, nb, t) {
    [67, 71, 74, 79].forEach((m, i) => {
      tone(ctx, out, { t: t + i * 0.08, type: 'triangle', f0: midiToFreq(m), dur: 0.4, gain: 0.22 });
    });
    noise(ctx, out, nb, { t: t + 0.24, dur: 0.6, gain: 0.05, filter: 'highpass', f0: 6000 });
  },
  win(ctx, out, nb, t) {
    const melody = [72, 76, 79, 84, 79, 84, 88];
    const times = [0, 0.12, 0.24, 0.36, 0.6, 0.72, 0.84];
    melody.forEach((m, i) => {
      const last = i === melody.length - 1;
      tone(ctx, out, { t: t + times[i], type: 'triangle', f0: midiToFreq(m), dur: last ? 1.4 : 0.3, gain: 0.25 });
      tone(ctx, out, { t: t + times[i], type: 'sine', f0: midiToFreq(m - 12), dur: last ? 1.4 : 0.3, gain: 0.12 });
    });
    [60, 64, 67].forEach((m) => {
      tone(ctx, out, { t: t + 0.84, type: 'sawtooth', f0: midiToFreq(m), dur: 1.6, gain: 0.05, attack: 0.1 });
    });
  },
  lose(ctx, out, nb, t) {
    [67, 63, 60, 55].forEach((m, i) => {
      tone(ctx, out, { t: t + i * 0.22, type: 'triangle', f0: midiToFreq(m), f1: midiToFreq(m) * 0.97, dur: 0.5, gain: 0.22 });
    });
  },
  click(ctx, out, nb, t) {
    tone(ctx, out, { t, type: 'sine', f0: 1320, f1: 990, dur: 0.06, gain: 0.18 });
  },
  hover(ctx, out, nb, t) {
    tone(ctx, out, { t, type: 'sine', f0: 880, dur: 0.035, gain: 0.06 });
  },
};

export const SFX_NAMES = Object.freeze(Object.keys(RECIPES));

export function playRecipe(ctx, out, noiseBuffer, name, { pitch = 1, when } = {}) {
  const recipe = RECIPES[name];
  if (!recipe) return false;
  recipe(ctx, out, noiseBuffer, when ?? ctx.currentTime, pitch);
  return true;
}
