import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000, // 30 seconds for long-running tests
    hookTimeout: 30000,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', 'backup/'],
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});