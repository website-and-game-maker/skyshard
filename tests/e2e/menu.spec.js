import { test, expect } from '@playwright/test';
import { startGame, waitForState, trackErrors } from './helpers.js';

test('play starts the game and shows the HUD', async ({ page }) => {
  const errors = trackErrors(page);
  await startGame(page);
  await expect(page.getByTestId('hud')).toBeVisible();
  await expect(page.getByTestId('play')).toBeHidden();
  expect(errors).toEqual([]);
});

test('escape pauses and resume continues', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard pause is a desktop control');
  await startGame(page);
  await page.keyboard.press('Escape');
  await waitForState(page, 'paused');
  await expect(page.getByTestId('resume')).toBeVisible();
  await page.getByTestId('resume').click();
  await waitForState(page, 'playing');
});

test('game pauses when the tab is hidden', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitForState(page, 'paused');
});
