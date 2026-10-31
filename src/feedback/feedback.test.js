import { describe, it, expect, vi } from 'vitest';
import { buildGameInfo, buildReport, checkMessage, describeClient, makeId, toFirestoreFields, KINDS, GAME_ID } from './report.js';
import { createSender, endpoint, OUTBOX_KEY } from './send.js';
import { createHostBridge } from './bridge.js';

function memoryStorage() {
  const data = {};
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => (data[k] = String(v)), removeItem: (k) => delete data[k] };
}

// The fields the arcade's firestore.rules allow on a report.
const ALLOWED = ['type', 'message', 'status', 'source', 'createdAt', 'queuedAt', 'gameId', 'gameTitle', 'gameName', 'contact', 'path', 'client', 'appVersion', 'userAgent', 'title', 'uid', 'authorName', 'schoolId', 'bugKind', 'log'];

const snap = { state: 'playing', player: { x: 1.234, y: 5, z: -2.06, grounded: true }, shards: 12, totalShards: 54, health: 2, deaths: 3, fps: 41, quality: 'medium', timeMs: 83500 };

describe('game details', () => {
  it('summarises the run in plain lines', () => {
    const text = buildGameInfo(snap, { version: '0.2.0', device: 'keyboard', screen: '1366x657 @1x', host: 'Arcade', errors: ['boom'] });
    expect(text).toContain('Skyshard 0.2.0');
    expect(text).toContain('State: playing');
    expect(text).toContain('Shards: 12 of 54');
    expect(text).toContain('Run time: 1:23.5');
    expect(text).toContain('Position: 1.2, 5, -2.1 (on ground)');
    expect(text).toContain('Graphics: medium, 41 fps');
    expect(text).toContain('Playing on: Arcade');
    expect(text).toContain('- boom');
  });
  it('copes with an empty snapshot', () => {
    expect(buildGameInfo(undefined)).toBe('Skyshard');
  });
});

describe('reports', () => {
  it('checks the message like the arcade does', () => {
    expect(checkMessage('  hi ').error).toBeTruthy();
    expect(checkMessage('!!!!!').error).toBeTruthy();
    expect(checkMessage('x'.repeat(1001)).error).toBeTruthy();
    expect(checkMessage('  The dash feels great  ')).toEqual({ message: 'The dash feels great' });
  });
  it('makes 20-character ids the rules accept', () => {
    expect(makeId()).toMatch(/^[A-Za-z0-9]{20}$/);
  });
  it('summarises the browser coarsely', () => {
    const ua = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
    expect(describeClient(ua)).toBe('Chrome 140, ChromeOS');
    expect(describeClient('')).toMatch(/^[A-Za-z0-9 ,.]{1,60}$/);
  });
  it('builds a problem report with game details, using only allowed fields', () => {
    const r = buildReport({ id: 'a'.repeat(20), kind: 'problem', message: 'Fell through the bridge', info: 'Skyshard', client: 'Chrome 140, ChromeOS', version: '0.2.0', now: 1000 });
    expect(r).toMatchObject({ type: 'broken-game', source: 'game', status: 'new', gameId: GAME_ID, gameTitle: 'Skyshard', path: '/skyshard', log: 'Skyshard' });
    const fields = toFirestoreFields(r, 5000);
    expect(Object.keys(fields).every((k) => ALLOWED.includes(k))).toBe(true);
    expect(fields.createdAt).toEqual({ integerValue: '5000' });
    expect(fields.queuedAt).toEqual({ integerValue: '1000' });
    expect(fields.message).toEqual({ stringValue: 'Fell through the bridge' });
  });
  it('leaves details off ideas, and queuedAt off a report sent at once', () => {
    const r = buildReport({ id: 'b'.repeat(20), kind: 'idea', message: 'More levels please', info: 'Skyshard', now: 1000 });
    expect(r.type).toBe('other');
    expect(r).not.toHaveProperty('log');
    expect(toFirestoreFields(r, 1000)).not.toHaveProperty('queuedAt');
  });
  it('offers a kind for problems and one for ideas', () => {
    expect(KINDS.map((k) => k.type)).toEqual(['broken-game', 'other']);
  });
});

describe('sender', () => {
  const report = (id, queuedAt = 1000) => buildReport({ id, kind: 'idea', message: 'Hello there', now: queuedAt });

  it('posts to the arcade inbox and clears the outbox', async () => {
    const storage = memoryStorage();
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    const sender = createSender({ storage, fetchImpl, now: () => 2000, win: null });
    expect(await sender.send(report('c'.repeat(20)))).toBe('sent');
    expect(fetchImpl.mock.calls[0][0]).toBe(endpoint('c'.repeat(20)));
    expect(fetchImpl.mock.calls[0][0]).toContain('/projects/arcade-library/');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).fields.source).toEqual({ stringValue: 'game' });
    expect(storage.data[OUTBOX_KEY]).toBeUndefined();
  });
  it('keeps a report when offline and sends it later, once', async () => {
    const storage = memoryStorage();
    let online = false;
    const fetchImpl = vi.fn(async () => {
      if (!online) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200 };
    });
    const sender = createSender({ storage, fetchImpl, now: () => 2000, win: null });
    expect(await sender.send(report('d'.repeat(20)))).toBe('queued');
    expect(sender.pending()).toBe(1);
    online = true;
    await sender.flush();
    expect(sender.pending()).toBe(0);
    await sender.flush();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('treats an earlier arrival as sent', async () => {
    const sender = createSender({ storage: memoryStorage(), fetchImpl: async () => ({ ok: false, status: 409 }), win: null });
    expect(await sender.send(report('e'.repeat(20)))).toBe('sent');
  });
  it('drops a refused report and reports reports older than a week', async () => {
    const storage = memoryStorage();
    const sender = createSender({ storage, fetchImpl: async () => ({ ok: false, status: 400 }), now: () => 2000, win: null });
    expect(await sender.send(report('f'.repeat(20)))).toBe('refused');
    expect(sender.pending()).toBe(0);
    storage.setItem(OUTBOX_KEY, JSON.stringify([report('g'.repeat(20), 0)]));
    const late = createSender({ storage, fetchImpl: vi.fn(), now: () => 8 * 86400000, win: null });
    await late.flush();
    expect(late.pending()).toBe(0);
  });
  it('says failed when it can neither send nor save', async () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    const sender = createSender({ storage: broken, fetchImpl: async () => { throw new TypeError('offline'); }, win: null });
    expect(await sender.send(report('h'.repeat(20)))).toBe('failed');
  });
});

describe('arcade bridge', () => {
  function fakeWindows() {
    const listeners = [];
    const parent = { posted: [], postMessage(m, o) { this.posted.push([m, o]); } };
    const win = {
      parent,
      location: { origin: 'https://arcade.test' },
      addEventListener: (t, fn) => listeners.push(fn),
      removeEventListener: () => {},
      emit: (data, source = parent, origin = 'https://arcade.test') => listeners.forEach((fn) => fn({ data, source, origin })),
    };
    return { win, parent };
  }

  it('says hello, and opens the arcade dialog only after the arcade answers', () => {
    const { win, parent } = fakeWindows();
    const bridge = createHostBridge({ win });
    expect(parent.posted[0]).toEqual([{ arcade: 1, type: 'hello', game: 'skyshard' }, 'https://arcade.test']);
    expect(bridge.openFeedback('x')).toBe(false);
    win.emit({ arcade: 1, type: 'host', feedback: true, name: 'Arcade' });
    expect(bridge.hosted).toBe(true);
    expect(bridge.hostName).toBe('Arcade');
    expect(bridge.openFeedback('details')).toBe(true);
    expect(parent.posted.at(-1)[0]).toEqual({ arcade: 1, type: 'feedback', info: 'details' });
  });
  it('pauses, answers info requests and hears when the dialog closes', () => {
    const { win, parent } = fakeWindows();
    const onPause = vi.fn();
    const onClosed = vi.fn();
    createHostBridge({ win, onPause, onClosed, getInfo: () => 'state' });
    win.emit({ arcade: 1, type: 'pause' });
    win.emit({ arcade: 1, type: 'info?' });
    win.emit({ arcade: 1, type: 'feedback-closed', sent: true });
    expect(onPause).toHaveBeenCalledOnce();
    expect(parent.posted.at(-1)[0]).toEqual({ arcade: 1, type: 'info', info: 'state' });
    expect(onClosed).toHaveBeenCalledWith(true);
  });
  it('ignores other windows and other origins', () => {
    const { win } = fakeWindows();
    const onPause = vi.fn();
    const bridge = createHostBridge({ win, onPause });
    win.emit({ arcade: 1, type: 'pause' }, {}, 'https://arcade.test');
    win.emit({ arcade: 1, type: 'host', feedback: true }, win.parent, 'https://evil.test');
    win.emit({ type: 'pause' });
    expect(onPause).not.toHaveBeenCalled();
    expect(bridge.hosted).toBe(false);
  });
  it('stays quiet on its own page', () => {
    const win = { location: { origin: 'https://x.test' }, addEventListener: () => {} };
    win.parent = win;
    const bridge = createHostBridge({ win });
    expect(bridge.openFeedback('x')).toBe(false);
  });
});
