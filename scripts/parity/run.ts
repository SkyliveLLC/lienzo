/**
 * Visual parity between the baseline renders (fixtures/baseline/<name>.html)
 * and the new renderer's output for the same document.
 *
 * Both pages load in headless Chromium from the same fake origin with every
 * other request aborted, so Google Fonts, media and embeds fail identically
 * and text falls back to the same local fonts. Reduced motion is on in both,
 * so entrance animations show their final state.
 *
 * States captured per fixture, at 1200px and 390px:
 *   page               the full page as loaded
 *   modal:<id>         the viewport with that modal opened by its own page script
 *   panel:<group>:<i>  the full page after clicking tab or step <i> of a group
 *
 * Verdict per fixture (all states, both widths):
 *   VERIFIED       every capture has the same size and at most THRESHOLD of its pixels differ
 *   INTENDED       it differs, but passes once the new page gets shims that put the
 *                  old bugs back (synthesis graft 8): the diff is those fixes and nothing else
 *   NOT VERIFIED   some capture differs more, or the page height differs, even with the shims
 *   INCONCLUSIVE   the baseline is not stable across two captures, or a capture failed
 *
 * Writes scripts/parity/out/report.json and, per differing capture, a PNG of
 * baseline | new | diff side by side.
 *
 * Usage: node scripts/parity/run.ts [name ...]
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { chromium, type Browser, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { readFixture, renderFixture } from '../../packages/core/scripts/golden.ts';
import { trustedHtml } from '../../packages/core/src/index.ts';

/**
 * Both pages run in the same engine with the same fonts, so equal layout
 * gives equal pixels; pixelmatch already skips antialiased edge pixels
 * (includeAA false, per-pixel threshold 0.1). 0.05% of a capture is the
 * budget for stray edge pixels. It is too small to hide a real change: one
 * 300x16px line of text that moves or changes color is 0.5% of a 1200x800
 * viewport and 0.13% of a 1200x3000 full page.
 */
const THRESHOLD = 0.0005;
const WIDTHS = [1200, 390] as const;
const ORIGIN = 'https://demo.test/';

const root = join(import.meta.dirname, '../..');
const baselineDir = join(root, 'fixtures/baseline');
const outDir = join(import.meta.dirname, 'out');

type Box = { x: number; y: number; w: number; h: number };
type Capture = { state: string; width: number; ratio: number; diff: number; size: string; sameSize: boolean; stable: boolean; box?: Box | null; error?: string };
const passes = (entry: Capture) => entry.sameSize && entry.ratio <= THRESHOLD;
type Verdict = 'VERIFIED' | 'INTENDED' | 'NOT VERIFIED' | 'INCONCLUSIVE';

type StoredSection = { group?: { id?: string | null; type?: string | null; label?: string | null } | null; background?: { overlay?: number | null }; elements?: { style?: { visible_on?: string } }[] };
type StoredDocument = { sections: StoredSection[]; modals?: { elements?: StoredSection['elements'] }[] | null };

/**
 * Each graft 8 fix, undone on the new page only. A fixture whose diff
 * disappears under the shims that apply to it differs by those fixes alone.
 */
const shims: { fix: string; markup: (document: StoredDocument) => string | null }[] = [
    {
        fix: 'visible_on mobile keeps the element\'s own display (the old page forced display:block)',
        markup: (document) => [...document.sections, ...(document.modals ?? [])].some((canvas) => canvas.elements?.some((element) => element.style?.visible_on === 'mobile'))
            // An app element's old root (the grid) is now the child of its positioned wrapper.
            // Forced to block, the old field labels also showed the whitespace between their tags.
            ? '<style>@container lz (max-width:640px){.lz-el[data-visible=mobile],.lz-el[data-type][data-visible=mobile]>*{display:block!important}}</style>'
                + '<script>document.querySelectorAll(".lz-field[data-visible=mobile] > input + span").forEach((span) => span.before(" "));</script>'
            : null,
    },
    {
        fix: 'section overlay is drawn (the old page ignored it)',
        markup: (document) => document.sections.some((section) => (section.background?.overlay ?? 0) > 0)
            ? '<style>.lz-overlay{display:none!important}</style>'
            : null,
    },
    {
        fix: 'an empty group label falls back to a localized "Step N" or "Tab N" (the old page showed it empty, and "Paso N" for tabs)',
        markup: (document) => {
            const labels = oldGroupLabels(document);

            return Object.values(labels).some((group, index) => group.join() !== Object.values(newGroupLabels(document))[index]?.join())
                ? `<script>for (const [id, labels] of Object.entries(${JSON.stringify(labels)})) document.querySelectorAll(\`#g-\${id} > .lz-stack-nav > button\`).forEach((button, index) => { const last = button.lastChild; if (last && last.nodeType === 3) { last.textContent = labels[index]; } else { button.append(labels[index]); } });</script>`
                : null;
        },
    },
];

function groupsOf(document: StoredDocument): { id: string; type: string; sections: StoredSection[] }[] {
    const runs: { id: string | null; type: string; sections: StoredSection[] }[] = [];

    for (const section of document.sections) {
        const id = section.group?.id || null;
        const last = runs.at(-1);

        if (id !== null && last?.id === id) {
            last.sections.push(section);
        } else {
            runs.push({ id, type: section.group?.type ?? 'tabs', sections: [section] });
        }
    }

    return runs.filter((run): run is { id: string; type: string; sections: StoredSection[] } => run.id !== null && run.sections.length > 1);
}

const oldGroupLabels = (document: StoredDocument) => Object.fromEntries(groupsOf(document)
    .map((group) => [group.id, group.sections.map((section, index) => section.group?.label ?? `Paso ${index + 1}`)]));
const newGroupLabels = (document: StoredDocument) => Object.fromEntries(groupsOf(document)
    .map((group) => [group.id, group.sections.map((section, index) => (section.group?.label?.trim() ? section.group.label : `${group.type === 'steps' ? 'Paso' : 'Pestaña'} ${index + 1}`))]));

async function open(browser: Browser, html: string, width: number): Promise<Page> {
    const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();

    await page.route('**/*', (route) => (route.request().url() === ORIGIN
        ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html })
        : route.abort()));
    await page.goto(ORIGIN, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);

    return page;
}

const shoot = (page: Page, fullPage: boolean) => page.screenshot({ fullPage, animations: 'disabled' });

/** App elements render where their data lives; here that is the markup the baseline produced for them. */
async function baselineAppMarkup(browser: Browser, html: string): Promise<Map<string, string>> {
    const page = await open(browser, html, 1200);
    const entries = await page.$$eval('[id^="e-"].cards, [id^="e-"].rows, [id^="e-"].chips', (nodes) => nodes.map((node) => {
        const classes = [...node.classList].filter((name) => name !== 'element').join(' ');
        const style = node.getAttribute('style');

        return [node.id.slice(2), `<div class="${classes}"${style ? ` style="${style}"` : ''}>${node.innerHTML}</div>`] as const;
    }));
    await page.context().close();

    return new Map(entries);
}

/** Interactive states both pages share, read from the baseline markup. */
async function statesOf(browser: Browser, html: string): Promise<string[]> {
    const page = await open(browser, html, 1200);
    const states = await page.evaluate(() => [
        ...[...document.querySelectorAll('dialog[id^="m-"]')].map((dialog) => `modal:${dialog.id.slice(2)}`),
        ...[...document.querySelectorAll('[id^="g-"]')].flatMap((group) => [...group.querySelectorAll('[data-go]')]
            .slice(1)
            .map((_, index) => `panel:${group.id.slice(2)}:${index + 1}`)),
    ]);
    await page.context().close();

    return ['page', ...states];
}

async function capture(browser: Browser, html: string, width: number, state: string): Promise<Buffer> {
    const page = await open(browser, html, width);

    try {
        if (state.startsWith('modal:')) {
            const id = state.slice('modal:'.length);
            await page.evaluate((dialogId) => (document.getElementById(`m-${dialogId}`) as HTMLDialogElement).showModal(), id);

            return await shoot(page, false);
        }

        if (state.startsWith('panel:')) {
            const [, group, index] = state.split(':');
            await page.click(`#g-${group} [data-go="${index}"]`);
        }

        return await shoot(page, true);
    } finally {
        await page.context().close();
    }
}

function compare(before: Buffer, after: Buffer): { diff: number; ratio: number; size: string; image: PNG; sameSize: boolean; box: Box | null } {
    const a = PNG.sync.read(before);
    const b = PNG.sync.read(after);
    const width = Math.max(a.width, b.width);
    const height = Math.max(a.height, b.height);
    const pad = (png: PNG) => {
        const out = new PNG({ width, height });
        out.data.fill(0);
        PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);

        return out;
    };
    const left = pad(a);
    const right = pad(b);
    const diffImage = new PNG({ width, height });
    const diff = pixelmatch(left.data, right.data, diffImage.data, width, height, { threshold: 0.1, diffMask: true });
    const box = diffBox(diffImage);
    // The side-by-side sheet shows only the differing region, with a margin, to stay small enough to read.
    const crop = box
        ? { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), w: Math.min(width, box.x + box.w + 40) - Math.max(0, box.x - 40), h: Math.min(height, box.y + box.h + 40) - Math.max(0, box.y - 40) }
        : { x: 0, y: 0, w: width, h: height };
    const sheet = new PNG({ width: crop.w * 3, height: crop.h });
    PNG.bitblt(left, sheet, crop.x, crop.y, crop.w, crop.h, 0, 0);
    PNG.bitblt(right, sheet, crop.x, crop.y, crop.w, crop.h, crop.w, 0);
    PNG.bitblt(diffImage, sheet, crop.x, crop.y, crop.w, crop.h, crop.w * 2, 0);

    return {
        diff,
        ratio: diff / (width * height),
        size: `${a.width}x${a.height} vs ${b.width}x${b.height}`,
        image: sheet,
        sameSize: a.width === b.width && a.height === b.height,
        box,
    };
}

/** Bounding box of the pixels pixelmatch marked as different (its diff mask paints them red). */
function diffBox(mask: PNG): Box | null {
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -1, -1];

    for (let y = 0; y < mask.height; y++) {
        for (let x = 0; x < mask.width; x++) {
            const at = (y * mask.width + x) * 4;

            if (mask.data[at + 3] !== 0 && mask.data[at] === 255 && mask.data[at + 1] === 0) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function main() {
    const only = process.argv.slice(2);
    const names = readdirSync(baselineDir)
        .filter((file) => file.endsWith('.html'))
        .map((file) => file.slice(0, -'.html'.length))
        .filter((name) => only.length === 0 || only.includes(name))
        .sort();

    if (only.length === 0) {
        rmSync(outDir, { recursive: true, force: true });
    }
    mkdirSync(outDir, { recursive: true });

    const browser = await chromium.launch();
    const report: Record<string, { verdict: Verdict; worst: number; intended: string[]; captures: Capture[] }> = {};

    for (const name of names) {
        const before = readFileSync(join(baselineDir, `${name}.html`), 'utf8');
        const apps = await baselineAppMarkup(browser, before);
        const rendered = await renderFixture(readFixture(name), (element) => trustedHtml(apps.get(element.id) ?? ''));
        const after = rendered.html;
        writeFileSync(join(outDir, `${name}.new.html`), after);
        const captures: Capture[] = [];

        for (const state of await statesOf(browser, before)) {
            for (const width of WIDTHS) {
                try {
                    const old = await capture(browser, before, width, state);
                    const stable = old.equals(await capture(browser, before, width, state));
                    const result = compare(old, await capture(browser, after, width, state));
                    const entry: Capture = { state, width, ratio: result.ratio, diff: result.diff, size: result.size, sameSize: result.sameSize, stable, box: result.box };
                    captures.push(entry);

                    if (entry.diff > 0 || !stable) {
                        writeFileSync(join(outDir, `${name}--${state.replaceAll(':', '_')}--${width}.png`), PNG.sync.write(result.image));
                    }
                } catch (error) {
                    captures.push({ state, width, ratio: 1, diff: -1, size: '', sameSize: false, stable: false, error: String(error) });
                }
            }
        }

        const inconclusive = captures.some((entry) => !entry.stable);
        const worst = Math.max(...captures.map((entry) => entry.ratio));
        const document = readFixture(name).document as StoredDocument;
        const applied = shims.map((shim) => ({ fix: shim.fix, markup: shim.markup(document) })).filter((shim) => shim.markup !== null);
        let intended: string[] = [];

        if (!inconclusive && !captures.every(passes) && applied.length > 0) {
            const shimmed = after.replace('</body>', `${applied.map((shim) => shim.markup).join('')}</body>`);
            const explained = await Promise.all(captures.filter((entry) => !passes(entry)).map(async (entry) => {
                const result = compare(await capture(browser, before, entry.width, entry.state), await capture(browser, shimmed, entry.width, entry.state));

                return result.sameSize && result.ratio <= THRESHOLD;
            }));
            intended = explained.every(Boolean) ? applied.map((shim) => shim.fix) : [];
        }

        const verdict: Verdict = inconclusive ? 'INCONCLUSIVE' : captures.every(passes) ? 'VERIFIED' : intended.length > 0 ? 'INTENDED' : 'NOT VERIFIED';
        report[name] = { verdict, worst, intended, captures };
        const resized = captures.filter((entry) => !entry.sameSize).map((entry) => `${entry.state}@${entry.width} ${entry.size}`);
        console.log(`${verdict.padEnd(13)} ${(worst * 100).toFixed(3).padStart(7)}%  ${name}${resized.length > 0 ? `  size: ${resized.join(', ')}` : ''}`);
    }

    await browser.close();
    writeFileSync(join(outDir, only.length === 0 ? 'report.json' : `report-${only.join('+')}.json`), `${JSON.stringify(report, null, 2)}\n`);
    const counts = Object.values(report).reduce<Record<string, number>>((all, { verdict }) => ({ ...all, [verdict]: (all[verdict] ?? 0) + 1 }), {});
    console.log(counts);
}

await main();
