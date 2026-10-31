// Sends Skyshard's own feedback form (used when the game is not inside the
// arcade) to the arcade's inbox, through Firestore's REST API.
//
// Nothing is lost and nothing is doubled: a report goes into a small outbox
// on the device before it is sent and leaves it only when the inbox answers.
// Its id is made up front, so a retry of a report that did arrive is refused
// as a duplicate instead of stored twice. Waiting reports are retried when the
// game loads and when the connection comes back.
import { toFirestoreFields } from './report.js';

export const PROJECT = 'arcade-library';
export const OUTBOX_KEY = 'skyshard.feedback.outbox';
const WEEK = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10000;

export function endpoint(id, project = PROJECT) {
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/feedback?documentId=${id}`;
}

export function createSender({ storage = safeStorage(), fetchImpl = globalThis.fetch?.bind(globalThis), now = () => Date.now(), win = globalThis } = {}) {
  function read() {
    try {
      const list = JSON.parse(storage?.getItem(OUTBOX_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
  function write(list) {
    try {
      if (list.length) storage?.setItem(OUTBOX_KEY, JSON.stringify(list));
      else storage?.removeItem(OUTBOX_KEY);
      return true;
    } catch {
      return false;
    }
  }
  function remove(id) {
    write(read().filter((r) => r.id !== id));
  }

  // 'sent' | 'queued' (kept on the device, will retry) | 'refused'
  async function post(report) {
    if (!fetchImpl) return 'queued';
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : 0;
    try {
      const res = await fetchImpl(endpoint(report.id), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fields: toFirestoreFields(report, now()) }),
        signal: ctrl?.signal,
      });
      if (res.ok || res.status === 409) return 'sent'; // 409: an earlier try already arrived
      if (res.status >= 500 || res.status === 429 || res.status === 403) return 'queued';
      return 'refused';
    } catch {
      return 'queued';
    } finally {
      clearTimeout(timer);
    }
  }

  let flushing = null;
  async function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      for (const report of read()) {
        if (now() - report.queuedAt > WEEK - 60000) {
          remove(report.id); // the inbox only takes reports up to a week old
          continue;
        }
        const result = await post(report);
        if (result !== 'queued') remove(report.id);
      }
    })().finally(() => (flushing = null));
    return flushing;
  }

  async function send(report) {
    const saved = write([...read().filter((r) => r.id !== report.id), report]);
    const result = await post(report);
    if (result !== 'queued') remove(report.id);
    // Not saved and not sent: say so instead of pretending it will retry.
    if (result === 'queued' && !saved) return 'failed';
    return result;
  }

  win?.addEventListener?.('online', () => void flush());

  return { send, flush, pending: () => read().length };
}

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
