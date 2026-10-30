import { clamp01, createNoiseBuffer } from './synth.js';
import { SFX_NAMES, playRecipe } from './sfx.js';
import { createMusicPlayer } from './music.js';

export { SFX_NAMES } from './sfx.js';
export { TRACKS } from './music.js';

const DEFAULT_VOLUMES = { master: 0.8, music: 0.6, sfx: 0.9 };

function defaultContextCtor() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

// The game's single audio entry point. Browsers only allow sound after a user
// gesture, so the context is created lazily in unlock(). Every method is a safe
// no-op before then, and when Web Audio is missing entirely.
export function createAudio({ AudioContextCtor = defaultContextCtor(), doc = globalThis.document } = {}) {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuffer = null;
  let music = null;
  let wantedTrack = null;
  const volumes = { ...DEFAULT_VOLUMES };
  // Throttle rapid repeats (e.g. collecting several shards in one frame).
  const lastPlayed = new Map();

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(volumes.master, t, 0.02);
    musicBus.gain.setTargetAtTime(volumes.music * 0.7, t, 0.02);
    sfxBus.gain.setTargetAtTime(volumes.sfx, t, 0.02);
  }

  function init() {
    if (ctx || !AudioContextCtor) return !!ctx;
    try {
      ctx = new AudioContextCtor();
    } catch {
      ctx = null;
      return false;
    }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    noiseBuffer = createNoiseBuffer(ctx);
    music = createMusicPlayer(ctx, musicBus, noiseBuffer);
    applyVolumes();
    if (doc && doc.addEventListener) {
      doc.addEventListener('visibilitychange', () => {
        if (doc.hidden) ctx.suspend?.();
        else ctx.resume?.();
      });
    }
    if (wantedTrack) music.play(wantedTrack);
    return true;
  }

  return {
    // Call from the first click/tap/keypress.
    unlock() {
      init();
      if (ctx && ctx.state === 'suspended') ctx.resume?.();
      return !!ctx;
    },
    play(name, opts = {}) {
      if (!ctx || !SFX_NAMES.includes(name)) return false;
      const now = ctx.currentTime;
      const prev = lastPlayed.get(name);
      if (prev != null && now - prev < 0.03) return false;
      lastPlayed.set(name, now);
      return playRecipe(ctx, sfxBus, noiseBuffer, name, opts);
    },
    startMusic(name) {
      wantedTrack = name;
      if (music) music.play(name);
    },
    stopMusic() {
      wantedTrack = null;
      if (music) music.stop();
    },
    setVolumes(v = {}) {
      for (const key of Object.keys(DEFAULT_VOLUMES)) {
        if (key in v) volumes[key] = clamp01(Number(v[key]));
      }
      applyVolumes();
    },
    getVolumes() {
      return { ...volumes };
    },
    get ready() {
      return !!ctx;
    },
    get currentTrack() {
      return music ? music.playing : null;
    },
  };
}
