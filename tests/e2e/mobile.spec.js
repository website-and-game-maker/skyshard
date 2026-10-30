import { test, expect } from '@playwright/test';
import { startGame, snapshot, trackErrors } from './helpers.js';

test.describe('touch devices', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile project only');

  test('tap to play works and fills the screen', async ({ page }) => {
    const errors = trackErrors(page);
    await startGame(page);
    await expect(page.getByTestId('hud')).toBeVisible();
    const box = await page.locator('canvas').first().boundingBox();
    const vp = page.viewportSize();
    expect(box.width).toBeGreaterThanOrEqual(vp.width * 0.95);
    expect(errors).toEqual([]);
  });

  test('on-screen controls appear and move the player', async ({ page }) => {
    await startGame(page);
    const stick = page.getByTestId('touch-stick');
    await expect(stick).toBeVisible();
    await page.waitForTimeout(500);
    const before = (await snapshot(page)).player;

    // Drag the stick upward with a real touch sequence over CDP.
    const b = await stick.boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, ty) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: ty, id: 1 }] });
    await touch('touchStart', y);
    for (let i = 1; i <= 5; i++) await touch('touchMove', y - i * 10);
    await page.waitForTimeout(800);
    await touch('touchEnd', y - 50);

    const after = (await snapshot(page)).player;
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.5);
  });

  test('a jump button is reachable', async ({ page }) => {
    await startGame(page);
    const jump = page.getByTestId('touch-jump');
    await expect(jump).toBeVisible();
    const b = await jump.boundingBox();
    // Big enough for a thumb (Apple and Google both suggest about 44-48px).
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
  });
});
