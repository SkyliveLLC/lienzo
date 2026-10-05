import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests drive the real editor in Chromium against the dev harness
 * and its in-memory backend. The backend is shared, so tests run one at a
 * time and reset it first. The custom element test loads the standalone
 * bundle, so run `pnpm build` before `pnpm e2e`.
 */
const port = 5176;

export default defineConfig({
    testDir: 'e2e',
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${port}`,
        viewport: { width: 1440, height: 900 },
        trace: 'retain-on-failure',
    },
    webServer: {
        command: `npx vite --port ${port}`,
        env: { PORT: String(port), LIENZO_LATENCY: '40' },
        url: `http://localhost:${port}/api/`,
        reuseExistingServer: !process.env.CI,
    },
});
