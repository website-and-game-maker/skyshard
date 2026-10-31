import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative base so the build works at any path, including GitHub Pages under /skyshard/.
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        // Side page for trying control styles: /skyshard/controls-lab/
        controlsLab: fileURLToPath(new URL('./controls-lab/index.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['src/**/*.test.js', 'tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
