// Anonymous usage counts for the site that hosts Skyshard (Unblock Games).
// When the game runs in a frame on the same origin, it tells the parent page
// what happened: the game opened, a run started, a run was finished, and how
// many seconds were spent playing. The parent adds those to its counters.
// No ids, names, scores or device details are sent, and nothing at all leaves
// the page when the game runs on its own (no parent, or a parent on another
// origin, which postMessage then refuses to deliver to).

export const USAGE_KIND = 'skyshard-usage';
export const USAGE_VERSION = 1;
/** Play time is reported in chunks of at most this many seconds. */
export const MAX_CHUNK_SECONDS = 60;
const TICK_MS = 15_000;

/**
 * `createUsage({ levelId })` returns `{ runStarted(), setPlaying(bool), finished(timeMs), flush(), dispose() }`.
 * `levelId()` names the level being played (lowercase letters, digits and dashes).
 */
export function createUsage({
  levelId = () => 'driftmeadow',
  win = globalThis.window,
  doc = globalThis.document,
  now = () => performance.now(),
  setTimer = (fn, ms) => setInterval(fn, ms),
  clearTimer = (id) => clearInterval(id),
} = {}) {
  const target = parentOf(win);
  const origin = win?.location?.origin;
  const enabled = Boolean(target && origin && origin !== 'null');

  let playingSince = null; // now() when play time started counting, or null
  let pending = 0; // seconds played but not yet reported

  function send(event, data = {}) {
    if (!enabled) return;
    try {
      target.postMessage({ kind: USAGE_KIND, v: USAGE_VERSION, event, ...data }, origin);
    } catch {
      // A parent that went away or refuses messages is not the game's problem.
    }
  }

  function level() {
    const id = String(levelId() ?? '').toLowerCase();
    return /^[a-z0-9-]{1,40}$/.test(id) ? id : 'unknown';
  }

  function settle() {
    if (playingSince === null) return;
    const t = now();
    pending += Math.max(0, (t - playingSince) / 1000);
    playingSince = t;
  }

  /** Reports whole seconds in chunks. `all` also sends a final part chunk. */
  function report(all) {
    settle();
    while (pending >= MAX_CHUNK_SECONDS) {
      send('time', { seconds: MAX_CHUNK_SECONDS });
      pending -= MAX_CHUNK_SECONDS;
    }
    if (all && pending >= 1) {
      const seconds = Math.floor(pending);
      send('time', { seconds });
      pending -= seconds;
    }
  }

  const timer = enabled ? setTimer(() => report(false), TICK_MS) : null;
  const onHide = () => {
    if (doc?.visibilityState === 'hidden') report(true);
  };
  const onPageHide = () => report(true);
  if (enabled) {
    doc?.addEventListener?.('visibilitychange', onHide);
    win.addEventListener?.('pagehide', onPageHide);
  }

  send('session');

  return {
    enabled,
    runStarted() {
      send('run', { level: level() });
    },
    setPlaying(playing) {
      if (playing && playingSince === null) playingSince = now();
      else if (!playing && playingSince !== null) {
        settle();
        playingSince = null;
        report(false);
      }
    },
    finished(timeMs) {
      report(true);
      const seconds = Math.max(1, Math.min(3600, Math.round((Number(timeMs) || 0) / 1000)));
      send('finish', { level: level(), seconds });
    },
    flush() {
      report(true);
    },
    dispose() {
      if (timer !== null) clearTimer(timer);
      doc?.removeEventListener?.('visibilitychange', onHide);
      win?.removeEventListener?.('pagehide', onPageHide);
    },
  };
}

function parentOf(win) {
  try {
    if (!win || !win.parent || win.parent === win) return null;
    return win.parent;
  } catch {
    return null;
  }
}
