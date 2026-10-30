import { test, expect } from '@playwright/test';
import { startGame, snapshot, holdKey, dist, trackErrors } from './helpers.js';

test.describe('desktop controls', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard controls');

  test('WASD moves the player', async ({ page }) => {
    const errors = trackErrors(page);
    await startGame(page);
    await page.waitForTimeout(500); // let the player settle on the ground
    const before = (await snapshot(page)).player;
    await holdKey(page, 'w', 800);
    const after = (await snapshot(page)).player;
    expect(dist(before, after)).toBeGreaterThan(0.5);
    expect(errors).toEqual([]);
  });

  test('space makes the player jump', async ({ page }) => {
    await startGame(page);
    await page.waitForTimeout(500);
    const groundY = (await snapshot(page)).player.y;
    await page.keyboard.down('Space');
    let peak = groundY;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(50);
      peak = Math.max(peak, (await snapshot(page)).player.y);
    }
    await page.keyboard.up('Space');
    expect(peak - groundY).toBeGreaterThan(0.3);
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
