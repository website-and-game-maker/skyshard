import { test, expect } from '@playwright/test';
import { startGame, waitForState, snapshot, trackErrors } from './helpers.js';

test('feedback opens from pause, typing stays out of the game, Escape goes back', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard flow');
  const errors = trackErrors(page);
  await startGame(page);
  await page.keyboard.press('Escape');
  await waitForState(page, 'paused');
  await page.getByTestId('pause-feedback').click();
  const box = page.getByTestId('feedback-text');
  await expect(box).toBeFocused();
  // P and Space are game keys; here they are just letters.
  await page.keyboard.type('Pip slips on the spinning platform');
  await expect(box).toHaveValue('Pip slips on the spinning platform');
  expect((await snapshot(page)).state).toBe('paused');
  await expect(page.getByTestId('feedback-info-text')).toContainText('Shards:');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('resume')).toBeVisible();
  expect((await snapshot(page)).state).toBe('paused');
  expect(errors).toEqual([]);
});

test('Escape in pause settings goes back to pause without resuming', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard flow');
  await startGame(page);
  await page.keyboard.press('Escape');
  await waitForState(page, 'paused');
  await page.getByTestId('pause-settings').click();
  await page.getByTestId('settings-back').focus();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('resume')).toBeVisible();
  await page.waitForTimeout(300);
  expect((await snapshot(page)).state).toBe('paused');
});

test('the title offers feedback', async ({ page }) => {
  await page.goto('./');
  await waitForState(page, 'menu');
  await page.getByTestId('feedback').click();
  await expect(page.getByTestId('feedback-send')).toBeVisible();
});
