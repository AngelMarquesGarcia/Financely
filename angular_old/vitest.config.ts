import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { resolve } from 'path';

export default defineConfig({
  plugins: [angular()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['src/vitest.setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/environments/**', 'src/testing/**'],
    },
  },
});
