import { defineConfig, devices } from '@playwright/test';

/**
 * Drives the example app in Chromium. `composer run setup` installs the app
 * and resets its database, so every run starts from the seeded admin with no
 * site yet, exactly as after following the README.
 */
const port = 8124;

export default defineConfig({
    testDir: 'e2e',
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${port}`,
        viewport: { width: 1440, height: 900 },
        trace: 'retain-on-failure',
    },
    webServer: {
        command: `composer run setup --no-interaction && php artisan serve --host=127.0.0.1 --port=${port}`,
        env: { APP_URL: `http://127.0.0.1:${port}`, PHP_CLI_SERVER_WORKERS: '4' },
        url: `http://127.0.0.1:${port}/up`,
        timeout: 180_000,
        reuseExistingServer: false,
    },
});
