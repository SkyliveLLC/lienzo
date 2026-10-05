/**
 * Canvas isolation bench: the same 40-section page rendered by core, mounted
 * in a shadow root and in a same-origin iframe, then dragged. Run with
 * `node e2e/bench.ts` (starts the dev server and prints the numbers).
 */
import { emptyCatalog, parseDocument, parseSiteSettings, renderPage, type RenderedPage } from '@skylivellc/lienzo-core';
import lienzoCss from '@skylivellc/lienzo-core/lienzo.css?raw';

const SECTIONS = 40;
const WIDTH = 1200;
const SCALE = 0.75;

function element(id: string, type: string, x: number, y: number, w: number, h: number, props: object, style: object) {
    return { id, type, z: 1, layout: { desktop: { x, y, w, h }, mobile: null }, props, style };
}

function documentOf(count: number) {
    return {
        sections: Array.from({ length: count }, (_, index) => ({
            id: `s${index}`,
            height: { desktop: 560, mobile: 700 },
            background: { type: index % 3 === 0 ? 'gradient' : 'color', color: index % 2 ? 'surface' : 'background', gradient: { type: 'linear', from: 'primary', to: 'secondary', angle: 135 } },
            elements: [
                element(`h${index}`, 'heading', 6, 80, 44, 120, { text: `Section ${index} heading that wraps`, level: 2 }, { color: 'text', font: 'heading', size: 44, weight: 700 }),
                element(`t${index}`, 'text', 6, 220, 40, 120, { text: 'Body copy that explains the offer in a couple of lines of text.' }, { color: 'muted', size: 18, line_height: 1.6 }),
                element(`b${index}`, 'button', 6, 380, 18, 52, { label: 'Get started', action: { type: 'url', value: 'https://example.com' } }, { background: 'primary', color: 'background', radius: 12, shadow: 'md' }),
                element(`s${index}a`, 'shape', 55, 60, 38, 400, { shape: 'blob' }, { background: 'surface', opacity: 0.9 }),
                element(`i${index}`, 'icon', 60, 120, 6, 60, { icon: 'star', stroke: 2 }, { color: 'primary' }),
                element(`n${index}`, 'text', 60, 220, 30, 200, { text: 'Another block of text with a gradient fill and a blur behind it.' }, { color: 'text', blur: 8, background: 'background', background_opacity: 0.6, radius: 16, padding: 16 }),
            ],
        })),
    };
}

async function render(): Promise<RenderedPage> {
    const site = parseSiteSettings({ name: 'Bench', locale: 'en' });

    return renderPage({
        document: parseDocument(documentOf(SECTIONS), emptyCatalog),
        catalog: emptyCatalog,
        site,
        page: { slug: '', seo: {}, url: 'https://bench.test/' },
        base: '',
        mode: 'edit',
        host: { media: () => null, action: () => null, appElement: () => { throw new Error('no app elements'); }, form: null },
    });
}

type Mount = { name: string; page: HTMLElement; overlay: HTMLElement; replaceBody(html: string): void };

function shadowMount(page: RenderedPage, stage: HTMLElement): Mount {
    const host = document.createElement('div');
    stage.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(lienzoCss + page.css);
    root.adoptedStyleSheets = [sheet];
    const scaler = document.createElement('div');
    scaler.style.cssText = `width:${WIDTH}px;transform:scale(${SCALE});transform-origin:0 0;position:relative`;
    const body = document.createElement('div');
    body.className = 'lz-page';
    body.innerHTML = page.body;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;outline:2px solid #2563eb;pointer-events:none;left:0;top:0';
    scaler.append(body, overlay);
    root.append(scaler);

    return { name: 'shadow', page: body, overlay, replaceBody: (html) => { body.innerHTML = html; } };
}

async function iframeMount(page: RenderedPage, stage: HTMLElement): Promise<Mount> {
    const scaler = document.createElement('div');
    scaler.style.cssText = `width:${WIDTH}px;transform:scale(${SCALE});transform-origin:0 0;position:relative`;
    const frame = document.createElement('iframe');
    frame.style.cssText = `width:${WIDTH}px;border:0;display:block`;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;outline:2px solid #2563eb;pointer-events:none;left:0;top:0';
    scaler.append(frame, overlay);
    stage.append(scaler);
    await new Promise<void>((resolve) => {
        frame.onload = () => resolve();
        frame.srcdoc = `<!doctype html><html><head><style>html,body{margin:0}${lienzoCss}${page.css}</style></head><body><div class="lz-page">${page.body}</div></body></html>`;
    });
    const doc = frame.contentDocument!;
    const body = doc.querySelector<HTMLElement>('.lz-page')!;
    frame.style.height = `${doc.documentElement.scrollHeight}px`;

    return { name: 'iframe', page: body, overlay, replaceBody: (html) => { body.innerHTML = html; } };
}

const stats = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

    return { mean: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3), p50: +at(0.5).toFixed(3), p95: +at(0.95).toFixed(3), max: +at(1).toFixed(3) };
};

/** Synchronous cost of one drag step: set the vars, then read the box back as the overlay does. */
function dragSteps(mount: Mount, steps: number): number[] {
    const target = mount.page.querySelector<HTMLElement>('#e-t20')!;
    const times: number[] = [];

    for (let index = 0; index < steps; index++) {
        const start = performance.now();
        target.style.setProperty('--x', String(6 + (index % 40) * 0.5));
        target.style.setProperty('--y', String(220 + (index % 30) * 4));
        const left = target.offsetLeft;
        const top = target.offsetTop + target.closest<HTMLElement>('.lz-section')!.offsetTop;
        mount.overlay.style.transform = `translate(${left}px,${top}px)`;
        mount.overlay.style.width = `${target.offsetWidth}px`;
        mount.overlay.style.height = `${target.offsetHeight}px`;
        times.push(performance.now() - start);
    }

    return times;
}

/** Frame intervals while dragging one step per animation frame. */
function dragFrames(mount: Mount, frames: number): Promise<number[]> {
    const target = mount.page.querySelector<HTMLElement>('#e-t20')!;
    const intervals: number[] = [];
    let last = performance.now();
    let index = 0;

    return new Promise((resolve) => {
        const tick = (now: number) => {
            intervals.push(now - last);
            last = now;
            target.style.setProperty('--x', String(6 + (index % 40) * 0.5));
            target.style.setProperty('--y', String(220 + (index % 30) * 4));
            mount.overlay.style.transform = `translate(${target.offsetLeft}px,${target.offsetTop + target.closest<HTMLElement>('.lz-section')!.offsetTop}px)`;
            if (++index < frames) {
                requestAnimationFrame(tick);
            } else {
                resolve(intervals.slice(2));
            }
        };
        requestAnimationFrame(tick);
    });
}

async function commits(mount: Mount, runs: number): Promise<number[]> {
    const times: number[] = [];

    for (let index = 0; index < runs; index++) {
        const start = performance.now();
        const page = await render();
        mount.replaceBody(page.body);
        void mount.page.offsetHeight;
        times.push(performance.now() - start);
    }

    return times;
}

async function run(kind: 'shadow' | 'iframe') {
    const stage = document.createElement('div');
    document.body.append(stage);
    const renderStart = performance.now();
    const page = await render();
    const renderMs = performance.now() - renderStart;
    const mountStart = performance.now();
    const mount = kind === 'shadow' ? shadowMount(page, stage) : await iframeMount(page, stage);
    void mount.page.offsetHeight;
    const mountMs = performance.now() - mountStart;
    dragSteps(mount, 50);
    const steps = stats(dragSteps(mount, 600));
    const frames = await dragFrames(mount, 240);
    const commit = stats(await commits(mount, 10));
    stage.remove();

    return {
        kind,
        renderMs: +renderMs.toFixed(1),
        mountMs: +mountMs.toFixed(1),
        dragStepMs: steps,
        frameMs: stats(frames),
        droppedFrames: frames.filter((interval) => interval > 20).length,
        fullRerenderMs: commit,
        bodyBytes: page.body.length,
    };
}

const results = { shadow: await run('shadow'), iframe: await run('iframe'), shadow2: await run('shadow'), iframe2: await run('iframe') };
document.getElementById('out')!.textContent = JSON.stringify(results);
(window as unknown as { benchResults: unknown }).benchResults = results;
