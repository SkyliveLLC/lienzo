import { expect, test, type Locator } from '@playwright/test';

/** The prebuilt bundle a backend without a JS build ships: `<lienzo-editor>` with Vue inside, in a shadow root. */
test('the standalone custom element edits a page from a plain HTML host', async ({ page, request }) => {
    await request.post('/api/__reset');
    const response = await page.goto('/standalone.html');
    expect(response?.ok()).toBe(true);

    const host = page.locator('lienzo-editor');
    await expect(host.getByRole('button', { name: 'Publicar' })).toBeVisible();
    expect(await host.evaluate((node) => node.shadowRoot !== null)).toBe(true);

    // The hostile host CSS uppercases every paragraph; the editor chrome stays untouched.
    await expect(host.locator('.lze-save-status')).toHaveCSS('text-transform', 'none');

    const canvas = page.frameLocator('lienzo-editor >> iframe.lze-frame');
    await expect(canvas.locator('h1.lz-el')).toHaveText('Build something people remember');

    // The host's own `style` on the element must not reach the editor's layout:
    // with it on the root, the body grows to its content and the canvas stops scrolling.
    const stage = host.locator('.lze-stage');
    expect(await stage.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeGreaterThan(0);
    await stage.evaluate((node) => node.scrollBy(0, 300));
    expect(await stage.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

    await host.locator('.lze-palette-item', { hasText: /^Título$/ }).click();
    await expect(canvas.locator('section.lz-section').first().locator('h1.lz-el')).toHaveCount(2);
    await expect(host.getByTestId('save-status')).toHaveText(/Borrador guardado/, { timeout: 10_000 });
});

test.describe('a host control in the toolbar-start slot', () => {
    type Box = { x: number; y: number; width: number; height: number };
    const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

    async function box(locator: Locator): Promise<Box> {
        const found = await locator.boundingBox();

        if (!found) {
            throw new Error('Not visible');
        }

        return found;
    }

    const boxes = async (locator: Locator) => Promise.all((await locator.all()).map(box));

    test('sits at the start of the toolbar, clear of its controls', async ({ page, request }) => {
        await request.post('/api/__reset');
        await page.goto('/standalone.html');
        const host = page.locator('lienzo-editor');
        await expect(host.getByRole('button', { name: 'Publicar' })).toBeVisible();

        const back = host.getByRole('link', { name: 'Volver' });
        await back.click({ trial: true });
        const link = await box(back);
        const toolbar = await box(host.locator('.lze-toolbar'));
        const controls = await boxes(host.locator('.lze-toolbar-group > :not(slot)'));

        expect(controls.length).toBeGreaterThan(5);
        expect(link.y).toBeGreaterThanOrEqual(toolbar.y);
        expect(link.y + link.height).toBeLessThanOrEqual(toolbar.y + toolbar.height);
        expect(link.x).toBeLessThan(Math.min(...controls.map((control) => control.x)));
        expect(controls.filter((control) => overlaps(control, link))).toEqual([]);
    });

    test('stays at the same place when the editor cannot load', async ({ page }) => {
        await page.route('**/api', (route) => route.fulfill({ status: 500, json: { message: 'Down' } }));
        await page.goto('/standalone.html');
        const host = page.locator('lienzo-editor');
        await expect(host.getByRole('alert')).toBeVisible();

        const back = host.getByRole('link', { name: 'Volver' });
        await back.click({ trial: true });
        const link = await box(back);
        const failure = await boxes(host.getByRole('alert').locator('p, button'));
        const message = await box(host.getByRole('alert').locator('p'));
        const editor = await box(host);

        expect(Math.abs(message.x + message.width / 2 - (editor.x + editor.width / 2))).toBeLessThan(2);
        expect(link.x).toBeLessThan(40);
        expect(link.y).toBeLessThan(40);
        expect(failure.filter((part) => overlaps(part, link))).toEqual([]);
    });
});
