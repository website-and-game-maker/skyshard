import { test, expect } from '@playwright/test';
import { startGame, snapshot, holdKey, dist, trackErrors } from './helpers.js';

test.describe('desktop controls', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard controls');

  test('WASD moves the player', async ({ page }) => {
    const errors = trackErrors(page);
    await startGame(page);
    await page.waitForTimeout(500); // let the player settle on the ground
    const before = (await snapshot(page)).player;
    // CI renders in software at a few fps and the game caps simulated time per
    // frame, so hold the key until the player has moved rather than for a set time.
    await page.keyboard.down('w');
    await expect.poll(async () => dist(before, (await snapshot(page)).player), { timeout: 20_000 }).toBeGreaterThan(0.5);
    await page.keyboard.up('w');
    expect(errors).toEqual([]);
  });

  test('space makes the player jump', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(500);
    const groundY = (await snapshot(page)).player.y;
    await page.keyboard.down('Space');
    // Poll rather than sample a fixed window, so a slow software renderer still sees the arc.
    await expect.poll(async () => (await snapshot(page)).player.y - groundY, { timeout: 20_000, intervals: [30] }).toBeGreaterThan(0.3);
    await page.keyboard.up('Space');
  });

  test('player stays in a sane place during play', async ({ page }) => {
    await startGame(page);
    for (const key of ['w', 'a', 's', 'd']) await holdKey(page, key, 300);
    const s = await snapshot(page);
    for (const v of [s.player.x, s.player.y, s.player.z]) expect(Number.isFinite(v)).toBe(true);
    expect(s.shards).toBeGreaterThanOrEqual(0);
    expect(s.shards).toBeLessThanOrEqual(s.totalShards);
  });
});

test('a gamepad can be connected without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await startGame(page);
  await page.evaluate(() => {
    const pad = { id: 'test pad', index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
      axes: [0, -1, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    navigator.getGamepads = () => [pad, null, null, null];
    const ev = new Event('gamepadconnected');
    ev.gamepad = pad;
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(800);
  const s = await snapshot(page);
  expect(Number.isFinite(s.player.x)).toBe(true);
  expect(errors).toEqual([]);
});
