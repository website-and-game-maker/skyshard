// What a feedback report says about the game, and how it is written for the
// arcade's inbox. Pure functions, so they can be tested without a browser.
//
// Every report goes to one inbox: the Unblock Games arcade's feedback
// collection. Inside the arcade the site's own report dialog sends it (see
// bridge.js); on Skyshard's own page, send.js writes the same document.

export const GAME_ID = 'original-skyshard';
export const GAME_TITLE = 'Skyshard';
export const MESSAGE_MIN = 3;
export const MESSAGE_MAX = 1000;
export const INFO_MAX = 4000;

// The two kinds a player picks from. `type` is the arcade's report type.
export const KINDS = [
  { id: 'problem', label: 'Something is wrong', type: 'broken-game', placeholder: 'What happened? Where were you, and what did you expect?' },
  { id: 'idea', label: 'Idea or comment', type: 'other', placeholder: 'What would make Skyshard better?' },
];

export function kindById(id) {
  return KINDS.find((k) => k.id === id) ?? KINDS[0];
}

const STATE_LABELS = { menu: 'on the title screen', playing: 'playing', paused: 'paused', won: 'finished the level', gameover: 'game over' };

function formatClock(ms) {
  const total = Math.max(0, Math.round(ms || 0));
  const m = Math.floor(total / 60000);
  const s = ((total % 60000) / 1000).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

// The game details a report can carry. The player sees this exact text before
// it goes and can leave it out. Nothing personal: no names, no typed text.
export function buildGameInfo(snap = {}, extra = {}) {
  const lines = [`Skyshard ${extra.version ?? ''}`.trim()];
  if (snap.state) lines.push(`State: ${STATE_LABELS[snap.state] ?? snap.state}`);
  if (Number.isFinite(snap.totalShards)) lines.push(`Shards: ${snap.shards ?? 0} of ${snap.totalShards}`);
  if (Number.isFinite(snap.timeMs)) lines.push(`Run time: ${formatClock(snap.timeMs)}`);
  if (Number.isFinite(snap.health)) lines.push(`Hearts: ${snap.health}, falls: ${snap.deaths ?? 0}`);
  if (snap.player) {
    const r = (n) => Math.round(n * 10) / 10;
    lines.push(`Position: ${r(snap.player.x)}, ${r(snap.player.y)}, ${r(snap.player.z)}${snap.player.grounded ? ' (on ground)' : ' (in air)'}`);
  }
  if (snap.quality) lines.push(`Graphics: ${snap.quality}, ${snap.fps ?? '?'} fps`);
  if (extra.device) lines.push(`Controls: ${extra.device}`);
  if (extra.screen) lines.push(`Screen: ${extra.screen}`);
  if (extra.host) lines.push(`Playing on: ${extra.host}`);
  if (extra.errors?.length) lines.push('Recent errors:', ...extra.errors.slice(-5).map((e) => `- ${e}`));
  return lines.join('\n').slice(0, INFO_MAX);
}

// "Chrome 140, Windows": the same coarse summary the arcade stores, never the full user agent.
export function describeClient(ua = '') {
  const browser =
    /Edg\/(\d+)/.exec(ua) ? `Edge ${/Edg\/(\d+)/.exec(ua)[1]}` :
    /Firefox\/(\d+)/.exec(ua) ? `Firefox ${/Firefox\/(\d+)/.exec(ua)[1]}` :
    /Chrome\/(\d+)/.exec(ua) ? `Chrome ${/Chrome\/(\d+)/.exec(ua)[1]}` :
    /Version\/(\d+).*Safari/.exec(ua) ? `Safari ${/Version\/(\d+).*Safari/.exec(ua)[1]}` : 'Other browser';
  const os =
    /CrOS/.test(ua) ? 'ChromeOS' :
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : 'Other';
  return `${browser}, ${os}`;
}

// Trimmed message, or an error string the form shows.
export function checkMessage(text) {
  const message = String(text ?? '').trim();
  if (message.length < MESSAGE_MIN || !/[\p{L}\p{N}]/u.test(message)) return { error: 'Write a few words first.' };
  if (message.length > MESSAGE_MAX) return { error: `Keep it under ${MESSAGE_MAX} characters.` };
  return { message };
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// A 20-character id made on the device, so a retry can never store a copy.
export function makeId(random = Math.random) {
  let id = '';
  for (let i = 0; i < 20; i++) id += ID_CHARS[Math.floor(random() * ID_CHARS.length)];
  return id;
}

// The report as the arcade's firestore.rules accept it (source 'game').
export function buildReport({ id, kind, message, info, client, version, now }) {
  const k = kindById(kind);
  const report = {
    id,
    type: k.type,
    message,
    status: 'new',
    source: 'game',
    queuedAt: now,
    gameId: GAME_ID,
    gameTitle: GAME_TITLE,
    path: '/skyshard',
  };
  if (client && /^[A-Za-z0-9 ,.]{1,60}$/.test(client)) report.client = client;
  if (version && /^[A-Za-z0-9._+-]{1,40}$/.test(version)) report.appVersion = version;
  // Only problem reports carry the game details, like the arcade's tech log.
  if (info && k.type === 'broken-game') report.log = info.slice(0, INFO_MAX);
  return report;
}

// Firestore REST encoding of a report, stamped with the time it is sent.
export function toFirestoreFields(report, sentAt) {
  const fields = {};
  for (const [key, value] of Object.entries(report)) {
    if (key === 'id') continue;
    if (key === 'queuedAt') continue;
    fields[key] = { stringValue: value };
  }
  fields.createdAt = { integerValue: String(Math.round(sentAt)) };
  if (report.queuedAt && report.queuedAt < sentAt) fields.queuedAt = { integerValue: String(Math.round(report.queuedAt)) };
  return fields;
}
