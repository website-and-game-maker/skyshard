// Small, pure helpers shared by the sound effects and the music sequencer.

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
};

// Map a scale degree (any integer, negative allowed) to a MIDI note.
export function degreeToMidi(root, scale, degree) {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  const idx = ((degree % n) + n) % n;
  return root + octave * 12 + scale[idx];
}

// Deterministic PRNG so the same seed always composes the same tune.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

// One second of white noise, reused by every noisy sound.
export function createNoiseBuffer(ctx, seconds = 1) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rand = mulberry32(1234);
  for (let i = 0; i < length; i++) data[i] = rand() * 2 - 1;
  return buffer;
}

// An oscillator with a pitch sweep and an attack/decay envelope.
export function tone(ctx, out, opts) {
  const {
    t = ctx.currentTime,
    type = 'sine',
    f0 = 440,
    f1 = f0,
    dur = 0.2,
    gain = 0.3,
    attack = 0.005,
    detune = 0,
  } = opts;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env);
  env.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  return osc;
}

// A burst of filtered noise with a sweeping cutoff.
export function noise(ctx, out, buffer, opts) {
  const {
    t = ctx.currentTime,
    dur = 0.2,
    gain = 0.3,
    filter = 'lowpass',
    f0 = 2000,
    f1 = f0,
    q = 1,
    attack = 0.005,
  } = opts;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  biquad.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) biquad.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(biquad);
  biquad.connect(env);
  env.connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
  return src;
}
