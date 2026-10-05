import { expect, test } from '@playwright/test';

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

    await host.locator('.lze-palette-item', { hasText: /^Título$/ }).click();
    await expect(canvas.locator('section.lz-section').first().locator('h1.lz-el')).toHaveCount(2);
    await expect(host.getByTestId('save-status')).toHaveText(/Borrador guardado/, { timeout: 10_000 });
});
