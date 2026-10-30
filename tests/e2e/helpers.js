// Shared helpers. The game exposes a read-only snapshot on window.__SKYSHARD__
// ({ state, player: {x,y,z,grounded}, shards, totalShards, health, deaths, fps,
// timeMs, frame, quality }) that tests poll.

export const snapshot = (page) =>
  page.evaluate(() => {
    const s = window.__SKYSHARD__;
    return s ? JSON.parse(JSON.stringify(s)) : null;
  });

export const waitForState = (page, state, timeout = 30_000) =>
  page.waitForFunction((want) => window.__SKYSHARD__?.state === want, state, { timeout });

// Collects uncaught errors and console errors so every test can assert a clean run.
export function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Browsers block audio until a gesture; that warning is expected, not a bug.
    if (/AudioContext|autoplay/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

export async function openMenu(page) {
  await page.goto('./');
  await waitForState(page, 'menu');
}

export async function startGame(page) {
  await openMenu(page);
  await page.getByTestId('play').click();
  await waitForState(page, 'playing');
  // Wait for the simulation to actually advance; shader compiles can stall the first frames.
  await page.waitForFunction(() => window.__SKYSHARD__?.timeMs > 0, null, { timeout: 30_000 });
}

// Holds a key for a while; works for keyboard-driven movement on desktop.
export async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
