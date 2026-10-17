import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // tests/e2e holds the Playwright suite, which Vitest must not pick up
    include: ['src/**/*.test.ts'],
  },
});
