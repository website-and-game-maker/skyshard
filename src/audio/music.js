import { SCALES, degreeToMidi, midiToFreq, mulberry32, tone, noise } from './synth.js';

// Each track is a key, a tempo, a chord loop (as scale degrees) and a seed.
// composeTrack turns that into a list of 16th-note steps; the player loops it.
export const TRACKS = {
  title: { bpm: 76, root: 62, scale: 'lydian', chords: [0, 2, 3, 1], seed: 7, drums: false, leadDensity: 0.32 },
  level: { bpm: 116, root: 60, scale: 'major', chords: [0, 5, 3, 4], seed: 21, drums: true, leadDensity: 0.55 },
};

const STEPS_PER_BAR = 16;

export function composeTrack(name) {
  const def = TRACKS[name];
  if (!def) throw new Error(`Unknown track: ${name}`);
  const scale = SCALES[def.scale];
  const rand = mulberry32(def.seed);
  const steps = [];
  // Two passes over the progression: the second pass answers the first with
  // a re-rolled melody, so the loop does not feel like a 4-bar repeat.
  const bars = def.chords.length * 2;
  let lastDegree = 7;
  for (let bar = 0; bar < bars; bar++) {
    const chordDeg = def.chords[bar % def.chords.length];
    const chordTones = [chordDeg, chordDeg + 2, chordDeg + 4];
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const step = { lead: null, bass: null, chord: null, kick: false, snare: false, hat: false };
      if (s === 0) step.chord = chordTones.map((d) => degreeToMidi(def.root, scale, d));
      if (def.drums ? s % 4 === 0 || s === 10 : s % 8 === 0) {
        step.bass = degreeToMidi(def.root - 24, scale, chordDeg);
      }
      if (def.drums) {
        step.kick = s === 0 || s === 8 || (s === 10 && bar % 2 === 1);
        step.snare = s === 4 || s === 12;
        step.hat = s % 2 === 0;
      }
      const strong = s % 4 === 0;
      if ((s % 2 === 0 && rand() < def.leadDensity) || s === 0) {
        let degree;
        if (strong) {
          // Land on a chord tone near the previous note.
          degree = nearest(chordTones.flatMap((d) => [d + 7, d + 14]), lastDegree);
        } else {
          degree = lastDegree + Math.round(rand() * 4 - 2);
        }
        degree = Math.max(4, Math.min(16, degree));
        lastDegree = degree;
        step.lead = degreeToMidi(def.root, scale, degree);
      }
      steps.push(step);
    }
  }
  return { name, bpm: def.bpm, drums: def.drums, stepsPerBar: STEPS_PER_BAR, steps };
}

function nearest(options, target) {
  return options.reduce((best, d) => (Math.abs(d - target) < Math.abs(best - target) ? d : best));
}

export function stepDuration(bpm) {
  return 60 / bpm / 4;
}

// Plays one composed track in a loop with a look-ahead scheduler, which keeps
// timing tight even when the main thread is busy rendering.
export function createMusicPlayer(ctx, out, noiseBuffer, { lookahead = 0.12, intervalMs = 25 } = {}) {
  let current = null;

  function playStep(track, step, t, bus) {
    const sd = stepDuration(track.bpm);
    if (step.chord) {
      for (const m of step.chord) {
        const f = midiToFreq(m - 12);
        tone(ctx, bus, { t, type: 'sawtooth', f0: f, dur: sd * 16, gain: 0.025, attack: sd * 4, detune: -7 });
        tone(ctx, bus, { t, type: 'triangle', f0: f, dur: sd * 16, gain: 0.04, attack: sd * 4, detune: 7 });
      }
    }
    if (step.bass != null) {
      tone(ctx, bus, { t, type: 'triangle', f0: midiToFreq(step.bass), dur: sd * 3, gain: 0.22 });
    }
    if (step.lead != null) {
      const f = midiToFreq(step.lead);
      tone(ctx, bus, { t, type: 'triangle', f0: f, dur: sd * 2.5, gain: 0.1 });
      tone(ctx, bus, { t, type: 'sine', f0: f * 2, dur: sd * 1.5, gain: 0.025 });
    }
    if (step.kick) tone(ctx, bus, { t, type: 'sine', f0: 140, f1: 45, dur: 0.18, gain: 0.35 });
    if (step.snare) noise(ctx, bus, noiseBuffer, { t, dur: 0.12, gain: 0.1, filter: 'highpass', f0: 1800 });
    if (step.hat) noise(ctx, bus, noiseBuffer, { t, dur: 0.035, gain: 0.04, filter: 'highpass', f0: 7000 });
  }

  function tick() {
    if (!current) return;
    const horizon = ctx.currentTime + lookahead;
    const sd = stepDuration(current.track.bpm);
    while (current.nextTime < horizon) {
      const step = current.track.steps[current.index];
      playStep(current.track, step, current.nextTime, current.bus);
      current.index = (current.index + 1) % current.track.steps.length;
      current.nextTime += sd;
    }
  }

  function stop(fade = 0.6) {
    if (!current) return;
    const { bus, timer } = current;
    clearInterval(timer);
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => bus.disconnect(), (fade + 0.1) * 1000);
    current = null;
  }

  function play(name, fadeIn = 0.8) {
    if (current && current.track.name === name) return;
    stop();
    const track = composeTrack(name);
    const bus = ctx.createGain();
    const t = ctx.currentTime;
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + fadeIn);
    bus.connect(out);
    current = { track, bus, index: 0, nextTime: t + 0.05, timer: null };
    tick();
    current.timer = setInterval(tick, intervalMs);
  }

  return {
    play,
    stop,
    get playing() {
      return current ? current.track.name : null;
    },
  };
}
