import { defineConfig } from 'vitest/config';

/** Unit tests cover the pure logic; the UI is covered end to end by Playwright in e2e/. */
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } });
