import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Drives the example server in Chromium. Each run starts the server on an
 * empty data directory; workers load this file again and inherit the same one
 * through the environment. Run `pnpm build` first: the server serves the
 * built editor bundle.
 */
const port = 4317;
const url = `http://127.0.0.1:${port}/`;
process.env.LIENZO_E2E_DATA ??= mkdtempSync(join(tmpdir(), 'lienzo-vanilla-'));

export default defineConfig({
    testDir: 'e2e',
    workers: 1,
    retries: 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: url,
        viewport: { width: 1440, height: 900 },
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'node server.ts',
        env: { PORT: String(port), PUBLIC_URL: url, LIENZO_DATA: process.env.LIENZO_E2E_DATA },
        url: `${url}api`,
        reuseExistingServer: false,
    },
});
