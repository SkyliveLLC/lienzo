/**
 * Prints computed styles of the same element in the baseline page and the
 * new render, for chasing a parity diff. Run run.ts first: it writes the new
 * render to out/<name>.new.html.
 *
 * Usage: node scripts/parity/probe.ts <name> <width> <selector> [property ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const [name = '', width = '1200', selector = 'body', ...wanted] = process.argv.slice(2);
const properties = wanted.length > 0 ? wanted : ['display', 'position', 'width', 'height', 'padding', 'margin', 'line-height', 'font-size', 'font-family', 'top', 'left', 'transform', 'translate', 'order'];
const pages = {
    baseline: readFileSync(join(import.meta.dirname, '../../fixtures/baseline', `${name}.html`), 'utf8'),
    new: readFileSync(join(import.meta.dirname, 'out', `${name}.new.html`), 'utf8'),
};
const browser = await chromium.launch();

for (const [label, html] of Object.entries(pages)) {
    const page = await browser.newPage({ viewport: { width: Number(width), height: 800 }, reducedMotion: 'reduce' });
    await page.route('**/*', (route) => (route.request().url() === 'https://demo.test/'
        ? route.fulfill({ body: html, contentType: 'text/html' })
        : route.abort()));
    await page.goto('https://demo.test/');
    const rows = await page.$$eval(selector, (nodes, props) => nodes.map((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();

        return `${node.tagName.toLowerCase()}#${node.id} [${Math.round(rect.x)},${Math.round(rect.y + scrollY)} ${Math.round(rect.width)}x${Math.round(rect.height)}] `
            + props.map((prop) => `${prop}=${style.getPropertyValue(prop)}`).join(' | ');
    }), properties);
    console.log(`--- ${label}\n${rows.join('\n')}`);
    await page.close();
}

await browser.close();
