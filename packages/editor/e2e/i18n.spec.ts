import { expect, test } from '@playwright/test';

test('the Spanish locale shows Spanish chrome', async ({ page, request }) => {
    await request.post('/api/__reset');
    await page.goto('/?locale=es');

    await expect(page.getByRole('button', { name: 'Publicar' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Elementos' })).toBeVisible();
    await expect(page.getByTestId('save-status')).toHaveText('Los cambios se guardan solos');
    await expect(page.locator('.lze-palette-item', { hasText: 'Lista desplegable' })).toBeVisible();
    // App labels from the catalog follow the editor language too.
    await expect(page.locator('.lze-palette-item', { hasText: 'Tarjeta de precio' })).toBeVisible();
});
