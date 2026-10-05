/**
 * Canvas isolation bench (dev/bench): prints drag and re-render timings for
 * a 40-section page mounted in a shadow root and in an iframe.
 *
 * Usage: node scripts/bench.ts   (needs a built @skylive/lienzo-core)
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname, server: { port: 5179 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();

try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', (error) => console.error(error));
    await page.goto('http://localhost:5179/bench/');
    const results = await page.waitForFunction(() => (window as unknown as { benchResults?: unknown }).benchResults, null, { timeout: 120_000 });
    console.log(JSON.stringify(await results.jsonValue(), null, 2));
} finally {
    await browser.close();
    await server.close();
}
