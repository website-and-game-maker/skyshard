import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works at any path, including GitHub Pages under /skyshard/.
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  test: {
    include: ['src/**/*.test.js', 'tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
