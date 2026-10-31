import { test, expect } from '@playwright/test';
import { openMenu, trackErrors, waitForState } from './helpers.js';

test('world map opens unlocked levels and starts them', async ({ page }) => {
  const errors = trackErrors(page);
  await openMenu(page);
  // A save where World 1 is cleared.
  await page.evaluate(() => localStorage.setItem('skyshard.save.v1', JSON.stringify({
    version: 1, skin: 'classic', seenIntro: {},
    levels: { driftmeadow: { done: true, bestMs: 90000 }, windward: { done: true, bestMs: 90000 }, bramblebrute: { done: true, bestMs: 90000 } },
  })));
  await page.reload();
  await waitForState(page, 'menu');
  await expect(page.getByTestId('play')).toHaveText('Continue');
  await page.getByTestId('worldmap').click();
  await page.getByTestId('world-ember').click();
  await expect(page.getByTestId('level-kiln-spire')).toBeDisabled();
  await page.getByTestId('level-cinder-steps').click();
  await waitForState(page, 'playing');
  await page.waitForFunction(() => window.__SKYSHARD__?.level === 'cinder-steps');
  expect(errors).toEqual([]);
});
