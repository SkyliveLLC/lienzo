/**
 * Drag smoothness of the real editor on a 40-section page: loads the dev
 * harness, grows the home page to 40 sections through the protocol, drags an
 * element for ~2s at 60 moves per second and prints the frame intervals the
 * browser produced meanwhile, plus the time each pointer move took to handle.
 *
 * Usage: node scripts/drag-bench.ts   (needs a built @skylivellc/lienzo-core)
 */
import { chromium } from 'playwright';
import { createServer } from 'vite';

const port = 5177;
const server = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname, server: { port }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();

type Section = { id: string; elements: { id: string }[] };

try {
    const base = `http://localhost:${port}`;
    await fetch(`${base}/api/__reset`, { method: 'POST' });
    const page = (await (await fetch(`${base}/api/pages/1`)).json()) as { revision: number; draft: { sections: Section[] } };
    const sections = Array.from({ length: 40 }, (_, copy) => page.draft.sections.map((section) => ({
        ...section,
        id: `${section.id}-${copy}`,
        elements: section.elements.map((element) => ({ ...element, id: `${element.id}-${copy}` })),
    }))).flat().slice(0, 40);
    const saved = await fetch(`${base}/api/pages/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevision: page.revision, draft: { sections } }),
    });

    if (!saved.ok) {
        throw new Error(`Seeding failed: ${saved.status} ${await saved.text()}`);
    }

    const tab = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await tab.goto(base);
    const canvas = tab.frameLocator('iframe.lze-frame');
    await canvas.locator('section.lz-section').nth(39).waitFor({ state: 'attached' });
    const target = canvas.locator('h1.lz-el').first();
    const box = await target.boundingBox();

    if (!box) {
        throw new Error('No heading on the canvas');
    }

    await tab.evaluate(() => {
        const record = { frames: [] as number[], moves: [] as number[] };
        let last = performance.now();
        const tick = (now: number) => {
            record.frames.push(now - last);
            last = now;
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        const frame = document.querySelector('iframe.lze-frame') as HTMLIFrameElement;
        // Capture starts the clock before the editor's handler; bubbling stops it after the handler and Vue's re-render.
        let started = 0;
        frame.contentDocument?.addEventListener('pointermove', () => {
            started = performance.now();
        }, true);
        frame.contentDocument?.addEventListener('pointermove', () => record.moves.push(performance.now() - started));
        (window as unknown as { dragRecord: typeof record }).dragRecord = record;
    });

    const start = { x: box.x + 20, y: box.y + 20 };
    await tab.mouse.move(start.x, start.y);
    await tab.mouse.down();
    await tab.evaluate(() => {
        (window as unknown as { dragRecord: { frames: number[] } }).dragRecord.frames.length = 0;
    });

    for (let step = 1; step <= 120; step++) {
        await tab.mouse.move(start.x + step * 2, start.y + Math.sin(step / 10) * 40);
        await tab.waitForTimeout(16);
    }

    await tab.mouse.up();
    const record = await tab.evaluate(() => (window as unknown as { dragRecord: { frames: number[]; moves: number[] } }).dragRecord);
    const stats = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

        return { count: values.length, mean: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2), p50: +at(0.5).toFixed(2), p95: +at(0.95).toFixed(2), max: +at(1).toFixed(2) };
    };

    console.log(JSON.stringify({
        sections: 40,
        elements: sections.reduce((sum, section) => sum + section.elements.length, 0),
        frameMs: stats(record.frames),
        framesOver20ms: record.frames.filter((interval) => interval > 20).length,
        pointerMoveHandlerMs: stats(record.moves),
    }, null, 2));
} finally {
    await browser.close();
    await server.close();
}
