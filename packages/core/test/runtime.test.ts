import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { readFixture, renderFixture } from '../scripts/golden.ts';

let browser: Browser;
let page: Page;

beforeAll(async () => {
    const { html } = await renderFixture(readFixture('app-plugin'));
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
    await page.route('**/*', (route) => (route.request().url() === 'https://demo.test/offers'
        ? route.fulfill({ body: html, contentType: 'text/html' })
        : route.abort()));
    await page.goto('https://demo.test/offers');
});

afterAll(() => browser.close());

const currentStep = () => page.$eval('#g-signup', (stack) => [...stack.querySelectorAll('.lz-stack-panel')].findIndex((panel) => panel.hasAttribute('data-on')));

it('opens the step holding a validation error after a failed submission', async () => {
    expect(await currentStep()).toBe(1);
});

it('opens a modal from a navbar link and closes it from its button', async () => {
    await page.click('.lz-navbar-links a[data-modal="offer"]');
    expect(await page.$eval('#m-offer', (dialog) => (dialog as HTMLDialogElement).open)).toBe(true);
    await page.click('#m-offer [data-close]');
    expect(await page.$eval('#m-offer', (dialog) => (dialog as HTMLDialogElement).open)).toBe(false);
});

it('moves between steps, checking the visible step before moving on', async () => {
    await page.click('#g-signup [data-go="0"]');
    expect(await currentStep()).toBe(0);
    await page.fill('[name="fields[name]"]', '');
    await page.click('#e-next');
    expect(await currentStep()).toBe(0);
    await page.fill('[name="fields[name]"]', 'Ana');
    await page.click('#e-next');
    expect(await currentStep()).toBe(1);
});

it('marks the sticky navbar once the page scrolls and goes back to the top from a link', async () => {
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForFunction(() => document.querySelector('#e-nav')?.hasAttribute('data-scrolled'), undefined, { timeout: 3000 });
    await page.click('.lz-navbar-links a[data-top]', { timeout: 3000 });
    await page.waitForFunction(() => window.scrollY === 0, undefined, { timeout: 3000 });
});

it('reports form submissions to the host as a lead', async () => {
    const tracked = page.evaluate(() => new Promise((resolve) => document.addEventListener('lienzo:track', (event) => resolve((event as CustomEvent).detail.name), { once: true })));
    await page.$eval('#g-signup', (form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(await tracked).toBe('lead');
});
