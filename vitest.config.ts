import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.wrangler'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json'],
      reportsDirectory: 'coverage',
      include: ['**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '*.config.ts', 'node_modules', 'dist', '.wrangler'],
    },
  },
});
