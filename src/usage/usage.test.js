import { describe, expect, it } from 'vitest';
import { createUsage, MAX_CHUNK_SECONDS, USAGE_KIND } from './index.js';

function harness({ embedded = true, origin = 'https://games.example' } = {}) {
  const sent = [];
  const listeners = {};
  const parent = { postMessage: (msg, to) => sent.push({ msg, to }) };
  const win = {
    location: { origin },
    addEventListener: (name, fn) => (listeners[name] = fn),
    removeEventListener: () => {},
  };
  win.parent = embedded ? parent : win;
  const doc = {
    visibilityState: 'visible',
    addEventListener: (name, fn) => (listeners[name] = fn),
    removeEventListener: () => {},
  };
  let t = 0;
  let tick = null;
  const usage = createUsage({
    win,
    doc,
    now: () => t,
    setTimer: (fn) => ((tick = fn), 1),
    clearTimer: () => {},
    levelId: () => 'driftmeadow',
  });
  return {
    usage,
    sent,
    events: () => sent.map((s) => s.msg.event),
    advance(seconds) {
      t += seconds * 1000;
    },
    tick: () => tick?.(),
    fire: (name) => listeners[name]?.(),
    doc,
  };
}

describe('usage', () => {
  it('announces the session to a same-origin parent only', () => {
    const h = harness();
    expect(h.sent).toEqual([
      { msg: { kind: USAGE_KIND, v: 1, event: 'session' }, to: 'https://games.example' },
    ]);
  });

  it('sends nothing when the game runs on its own', () => {
    const h = harness({ embedded: false });
    h.usage.runStarted();
    h.usage.setPlaying(true);
    h.advance(500);
    h.usage.finished(500_000);
    expect(h.sent).toEqual([]);
    expect(h.usage.enabled).toBe(false);
  });

  it('sends nothing from a file:// page (opaque origin)', () => {
    const h = harness({ origin: 'null' });
    expect(h.sent).toEqual([]);
  });

  it('reports a run with its level and nothing identifying', () => {
    const h = harness();
    h.usage.runStarted();
    expect(h.sent[1].msg).toEqual({ kind: USAGE_KIND, v: 1, event: 'run', level: 'driftmeadow' });
  });

  it('counts only time spent playing, in capped chunks', () => {
    const h = harness();
    h.usage.setPlaying(true);
    h.advance(150);
    h.tick();
    const times = () => h.sent.filter((s) => s.msg.event === 'time').map((s) => s.msg.seconds);
    expect(times()).toEqual([MAX_CHUNK_SECONDS, MAX_CHUNK_SECONDS]);
    h.usage.setPlaying(false); // paused: the 30 s left wait for a full chunk or a flush
    h.advance(1000); // time in the pause menu is not play time
    h.usage.flush();
    expect(times()).toEqual([60, 60, 30]);
  });

  it('flushes the remainder when the tab is hidden or closed', () => {
    const h = harness();
    h.usage.setPlaying(true);
    h.advance(12.6);
    h.doc.visibilityState = 'hidden';
    h.fire('visibilitychange');
    h.advance(3);
    h.fire('pagehide');
    const times = h.sent.filter((s) => s.msg.event === 'time').map((s) => s.msg.seconds);
    expect(times).toEqual([12, 3]);
  });

  it('reports a finish with whole seconds, after the time it took', () => {
    const h = harness();
    h.usage.runStarted();
    h.usage.setPlaying(true);
    h.advance(42);
    h.usage.setPlaying(false);
    h.usage.finished(41_700);
    expect(h.events()).toEqual(['session', 'run', 'time', 'finish']);
    expect(h.sent.at(-1).msg).toMatchObject({ event: 'finish', level: 'driftmeadow', seconds: 42 });
  });

  it('never sends a level name the site would refuse', () => {
    const sent = [];
    const win = { location: { origin: 'https://x.example' }, parent: { postMessage: (m) => sent.push(m) } };
    const usage = createUsage({ win, doc: null, setTimer: () => 1, levelId: () => 'Bad Level!' });
    usage.runStarted();
    expect(sent.at(-1).level).toBe('unknown');
  });
});
