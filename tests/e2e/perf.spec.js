import { test, expect } from '@playwright/test';
import { openMenu, startGame } from './helpers.js';

// Headless CI has no GPU, so WebGL runs in software (SwiftShader) and real frame
// rates are impossible there. On software GL we only check the loop never freezes;
// on a real GPU we expect a smooth game. SKYSHARD_MIN_FPS overrides both.
const MAX_LOAD_MS = 10_000;

const isSoftwareGL = (page) =>
  page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '';
    return /swiftshader|llvmpipe|software/i.test(name);
  });

// Samples frames for a fixed time rather than a fixed count, so a slow
// software renderer can't push the test past its timeout.
const sampleFrames = (page, ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const times = [];
        const start = performance.now();
        let last = start;
        const tick = (now) => {
          times.push(now - last);
          last = now;
          if (now - start < ms) requestAnimationFrame(tick);
          else resolve({ fps: (times.length * 1000) / (now - start), worst: Math.max(...times), frames: times.length });
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

test('reaches the menu quickly', async ({ page }) => {
  const t0 = Date.now();
  await openMenu(page);
  expect(Date.now() - t0).toBeLessThan(MAX_LOAD_MS);
});

test('holds a playable frame rate', async ({ page }) => {
  await startGame(page);
  const software = await isSoftwareGL(page);
  await page.waitForTimeout(1000); // skip shader warm-up
  const { fps, worst, frames } = await sampleFrames(page, 4000);
  console.log(`${software ? 'software' : 'GPU'} GL: avg ${fps.toFixed(1)} fps over ${frames} frames, worst ${worst.toFixed(0)} ms`);
  if (software && !process.env.SKYSHARD_MIN_FPS) {
    // Software GL speed says nothing about real devices; just prove the loop is alive.
    expect(frames).toBeGreaterThanOrEqual(2);
    expect(worst).toBeLessThan(5000);
  } else {
    expect(fps).toBeGreaterThan(Number(process.env.SKYSHARD_MIN_FPS || 30));
    // A long hitch means a freeze (runaway loop, sync shader compile storm).
    expect(worst).toBeLessThan(500);
  }
});

test('drops to a lighter quality tier when the frame rate is low', async ({ page }) => {
  await startGame(page);
  test.skip(!(await isSoftwareGL(page)), 'only software GL is reliably slow enough');
  // Software GL runs far under 30 fps, so automatic quality should step down to low.
  await expect.poll(() => page.evaluate(() => window.__SKYSHARD__.quality), { timeout: 30_000 }).toBe('low');
});

test('memory does not climb while playing', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'performance.memory is Chromium only');
  await startGame(page);
  const heap = () => page.evaluate(() => performance.memory.usedJSHeapSize);
  await page.waitForTimeout(1000);
  const start = await heap();
  await page.waitForTimeout(5000);
  const end = await heap();
  // A slow leak (e.g. new geometry every frame) shows up as tens of MB in 5 s.
  expect(end - start).toBeLessThan(30 * 1024 * 1024);
});
