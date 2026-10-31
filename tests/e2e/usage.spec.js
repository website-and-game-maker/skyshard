import { test, expect } from '@playwright/test';

// The game in a same-origin frame tells its host page about sessions and runs.
// The host page is served by the test itself, on the preview server's origin.
const HOST = `<!doctype html><meta charset="utf-8"><title>host</title>
<script>window.got = []; addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data && e.data.kind === 'skyshard-usage') window.got.push(e.data);
});</script>
<iframe src="./" style="width:800px;height:500px;border:0"></iframe>`;

test('reports session and run to a same-origin host page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'one browser is enough for the message plumbing');
  await page.route('**/usage-host.html', (route) => route.fulfill({ contentType: 'text/html', body: HOST }));
  await page.goto('./usage-host.html');
  const events = () => page.evaluate(() => window.got.map((m) => m.event));
  await expect.poll(events, { timeout: 30_000 }).toContain('session');

  const frame = page.frameLocator('iframe');
  await frame.getByTestId('play').click();
  await expect.poll(events, { timeout: 30_000 }).toContain('run');
  const run = await page.evaluate(() => window.got.find((m) => m.event === 'run'));
  expect(run).toEqual({ kind: 'skyshard-usage', v: 1, event: 'run', level: 'driftmeadow' });
});

test('sends nothing when it runs on its own', async ({ page }) => {
  await page.addInitScript(() => {
    window.__posted = 0;
    const original = window.postMessage.bind(window);
    window.postMessage = (...args) => {
      if (args[0]?.kind === 'skyshard-usage') window.__posted += 1;
      return original(...args);
    };
  });
  await page.goto('./');
  await page.waitForFunction(() => window.__SKYSHARD__?.state === 'menu', null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.__posted)).toBe(0);
});
