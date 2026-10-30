import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAudio, SFX_NAMES } from './index.js';
import { composeTrack, createMusicPlayer, stepDuration, TRACKS } from './music.js';
import { midiToFreq, degreeToMidi, SCALES, mulberry32, clamp01 } from './synth.js';
import { FakeAudioContext } from './fake-audio-context.js';

const CONTRACT_NAMES = ['jump', 'doubleJump', 'dash', 'land', 'pound', 'shard', 'hurt', 'enemyDefeat', 'checkpoint', 'win', 'lose', 'click', 'hover'];

afterEach(() => vi.useRealTimers());

describe('synth helpers', () => {
  it('converts MIDI notes to frequencies', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(81)).toBeCloseTo(880);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
  });

  it('maps scale degrees across octaves, including negative ones', () => {
    const major = SCALES.major;
    expect(degreeToMidi(60, major, 0)).toBe(60);
    expect(degreeToMidi(60, major, 2)).toBe(64);
    expect(degreeToMidi(60, major, 7)).toBe(72);
    expect(degreeToMidi(60, major, -1)).toBe(59);
  });

  it('makes a repeatable random sequence in [0, 1)', () => {
    const a = mulberry32(5);
    const b = mulberry32(5);
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('clamps volumes and rejects junk', () => {
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
  });
});

describe('createAudio', () => {
  it('provides every sound named in the contract', () => {
    expect([...SFX_NAMES].sort()).toEqual([...CONTRACT_NAMES].sort());
  });

  it('is a silent no-op when Web Audio is missing', () => {
    const audio = createAudio({ AudioContextCtor: null, doc: null });
    expect(audio.unlock()).toBe(false);
    expect(audio.play('jump')).toBe(false);
    expect(() => {
      audio.startMusic('level');
      audio.stopMusic();
      audio.setVolumes({ master: 0.5 });
    }).not.toThrow();
  });

  it('does nothing before unlock, then plays every sound after', () => {
    let ctx;
    const Ctor = function () {
      ctx = new FakeAudioContext();
      return ctx;
    };
    const audio = createAudio({ AudioContextCtor: Ctor, doc: null });
    expect(audio.play('jump')).toBe(false);
    expect(audio.unlock()).toBe(true);
    expect(ctx.state).toBe('running');
    for (const name of CONTRACT_NAMES) {
      const before = ctx.nodes.length;
      ctx.currentTime += 1;
      expect(audio.play(name)).toBe(true);
      expect(ctx.nodes.length).toBeGreaterThan(before);
    }
  });

  it('ignores unknown names and throttles instant repeats', () => {
    const audio = createAudio({ AudioContextCtor: FakeAudioContext, doc: null });
    audio.unlock();
    expect(audio.play('nope')).toBe(false);
    expect(audio.play('shard')).toBe(true);
    expect(audio.play('shard')).toBe(false);
  });

  it('clamps and stores volumes', () => {
    const audio = createAudio({ AudioContextCtor: FakeAudioContext, doc: null });
    audio.setVolumes({ master: 3, music: -1, sfx: '0.25' });
    expect(audio.getVolumes()).toEqual({ master: 1, music: 0, sfx: 0.25 });
  });

  it('starts music that was requested before unlock', () => {
    vi.useFakeTimers();
    const audio = createAudio({ AudioContextCtor: FakeAudioContext, doc: null });
    audio.startMusic('title');
    expect(audio.currentTrack).toBe(null);
    audio.unlock();
    expect(audio.currentTrack).toBe('title');
    audio.startMusic('level');
    expect(audio.currentTrack).toBe('level');
    audio.stopMusic();
    expect(audio.currentTrack).toBe(null);
  });

  it('suspends while the tab is hidden', () => {
    const listeners = {};
    const doc = { hidden: false, addEventListener: (n, fn) => (listeners[n] = fn) };
    let ctx;
    const audio = createAudio({ AudioContextCtor: function () { return (ctx = new FakeAudioContext()); }, doc });
    audio.unlock();
    doc.hidden = true;
    listeners.visibilitychange();
    expect(ctx.state).toBe('suspended');
    doc.hidden = false;
    listeners.visibilitychange();
    expect(ctx.state).toBe('running');
  });
});

describe('music', () => {
  for (const name of Object.keys(TRACKS)) {
    it(`composes "${name}" deterministically with notes in range`, () => {
      const a = composeTrack(name);
      const b = composeTrack(name);
      expect(a).toEqual(b);
      expect(a.steps.length % a.stepsPerBar).toBe(0);
      expect(a.steps.length).toBeGreaterThanOrEqual(64);
      const leads = a.steps.map((s) => s.lead).filter((n) => n != null);
      expect(leads.length).toBeGreaterThan(8);
      for (const n of leads) {
        expect(n).toBeGreaterThanOrEqual(48);
        expect(n).toBeLessThanOrEqual(96);
      }
      // Every bar opens with a chord.
      for (let i = 0; i < a.steps.length; i += a.stepsPerBar) expect(a.steps[i].chord).toHaveLength(3);
    });
  }

  it('only the level track has drums', () => {
    expect(composeTrack('level').steps.some((s) => s.kick)).toBe(true);
    expect(composeTrack('title').steps.some((s) => s.kick || s.snare || s.hat)).toBe(false);
  });

  it('rejects unknown tracks', () => {
    expect(() => composeTrack('nope')).toThrow();
  });

  it('schedules steps ahead of time and keeps up as time passes', () => {
    vi.useFakeTimers();
    const ctx = new FakeAudioContext();
    const out = ctx.createGain();
    const player = createMusicPlayer(ctx, out, ctx.createBuffer(1, 10, 8000), { lookahead: 0.5, intervalMs: 25 });
    player.play('level');
    const oscs = () => ctx.nodes.filter((n) => n.kind === 'oscillator');
    const first = oscs().length;
    expect(first).toBeGreaterThan(0);
    // Nothing is scheduled past the look-ahead window.
    const sd = stepDuration(TRACKS.level.bpm);
    expect(Math.max(...oscs().map((o) => o.startTime))).toBeLessThan(0.5 + sd + 0.06);
    ctx.currentTime = 4;
    vi.advanceTimersByTime(30);
    expect(oscs().length).toBeGreaterThan(first);
    for (const o of oscs()) expect(Number.isFinite(o.startTime)).toBe(true);
    player.stop();
    expect(player.playing).toBe(null);
    const count = oscs().length;
    ctx.currentTime = 10;
    vi.advanceTimersByTime(1000);
    expect(oscs().length).toBe(count);
  });

  it('keeps playing the same track when asked twice', () => {
    vi.useFakeTimers();
    const ctx = new FakeAudioContext();
    const player = createMusicPlayer(ctx, ctx.createGain(), ctx.createBuffer(1, 10, 8000));
    player.play('title');
    const gains = ctx.count('gain');
    player.play('title');
    expect(ctx.count('gain')).toBe(gains);
  });
});
