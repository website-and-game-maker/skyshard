import { test, expect } from '@playwright/test';
import { startGame, snapshot, trackErrors, waitForState } from './helpers.js';

test('first Play starts the tutorial with a lesson card, and skipping goes to level 1', async ({ page }) => {
  test.setTimeout(150_000); // rebuilding a level in software WebGL takes a while
  const errors = trackErrors(page);
  await startGame(page);
  expect((await snapshot(page)).level).toBe('tutorial');
  const tip = page.getByTestId('tutorial-tip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Run');

  await page.getByTestId('skip-tutorial').click();
  await expect.poll(async () => (await snapshot(page)).level, { timeout: 60_000 }).toBe('driftmeadow');
  await expect(tip).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('skyshard.tutorialDone'))).toBe('1');

  // Once done, Play goes straight to level 1.
  await page.reload();
  await waitForState(page, 'menu');
  await page.getByTestId('play').click();
  await waitForState(page, 'playing', 60_000);
  expect((await snapshot(page)).level).toBe('driftmeadow');
  expect(errors).toEqual([]);
});
