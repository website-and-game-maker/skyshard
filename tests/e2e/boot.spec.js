import { test, expect } from '@playwright/test';
import { openMenu, snapshot, trackErrors } from './helpers.js';

test('boots to the menu with WebGL and no errors', async ({ page }) => {
  const errors = trackErrors(page);
  await openMenu(page);

  await expect(page).toHaveTitle(/skyshard/i);
  await expect(page.getByTestId('play')).toBeVisible();

  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const vp = page.viewportSize();
  // The game canvas should fill the window, not sit in a corner.
  expect(box.width).toBeGreaterThanOrEqual(vp.width * 0.95);
  expect(box.height).toBeGreaterThanOrEqual(vp.height * 0.95);

  const hasGL = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  expect(hasGL).toBe(true);

  const s = await snapshot(page);
  expect(s.state).toBe('menu');
  expect(Number.isInteger(s.totalShards) && s.totalShards >= 0).toBe(true);

  expect(errors).toEqual([]);
});

test('page has no horizontal scroll', async ({ page }) => {
  await openMenu(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('every built asset loads', async ({ page }) => {
  const failed = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => failed.push(`failed ${r.url()}`));
  await openMenu(page);
  expect(failed).toEqual([]);
});
