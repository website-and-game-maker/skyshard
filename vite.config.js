import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Relative base so the build works at any path, including GitHub Pages under /skyshard/.
  base: './',
  // Sent with feedback so a report says which build it came from.
  define: { __SKYSHARD_VERSION__: JSON.stringify(version) },
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  test: {
    include: ['src/**/*.test.js', 'tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
