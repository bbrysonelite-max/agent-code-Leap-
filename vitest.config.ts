import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '.encore/',
        'test/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        'backend/*/migrations/**'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '~encore': path.resolve(__dirname, './node_modules/encore.dev'),
      '~backend': path.resolve(__dirname, './backend'),
      '@': path.resolve(__dirname, './frontend')
    }
  }
});