import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import config from '../../vite.config.js';

// GitHub Pages serves the game from /skyshard/, so asset paths must be relative.
describe('build config', () => {
  it('uses a relative base path', () => {
    expect(config.base).toBe('./');
  });

  it('index.html has the title, a viewport tag and one game canvas', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    expect(html).toMatch(/<title>[^<]*Skyshard[^<]*<\/title>/i);
    expect(html).toMatch(/name="viewport"/);
    expect(html.match(/<canvas/g)).toHaveLength(1);
  });
});
