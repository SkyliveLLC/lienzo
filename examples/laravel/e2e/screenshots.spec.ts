import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Captures the README screenshots into docs/. Skipped unless
 * LIENZO_SCREENSHOTS is set; run it on its own, on a fresh database:
 * `LIENZO_SCREENSHOTS=1 pnpm --filter lienzo-example-laravel e2e screenshots`.
 */
test.skip(!process.env.LIENZO_SCREENSHOTS, 'Set LIENZO_SCREENSHOTS=1 to capture the README screenshots.');

const docs = join(import.meta.dirname, '../../../docs');

/** A soft gradient PNG drawn by GD, so the hero has a photo-sized image without a network fetch. */
const photo = () => execFileSync('php', ['-r', `
    $w = 1200; $h = 900; $i = imagecreatetruecolor($w, $h);
    for ($y = 0; $y < $h; $y++) { $t = $y / $h; imageline($i, 0, $y, $w, $y, imagecolorallocate($i, (int) (37 + 120 * $t), (int) (99 + 60 * $t), (int) (235 - 40 * $t))); }
    imagefilledellipse($i, 820, 300, 520, 520, imagecolorallocatealpha($i, 255, 255, 255, 90));
    imagepng($i);
`]);

test('README screenshots', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const editor = page.locator('lienzo-editor');
    const canvas = page.frameLocator('lienzo-editor >> iframe.lze-frame');
    const newPage = editor.getByRole('dialog', { name: 'New page' });
    await newPage.getByLabel('Title').fill('Home');
    await newPage.getByRole('button', { name: 'Create page' }).click();
    await editor.locator('.lze-right').getByRole('tab', { name: 'Page' }).click();
    await editor.locator('.lze-choice', { hasText: 'Direct' }).click();
    await expect(canvas.locator('section.lz-section')).toHaveCount(4);

    await canvas.getByRole('img', { name: 'Product photo' }).click();
    await editor.locator('.lze-right').getByRole('tab', { name: 'Design' }).click();
    await editor.locator('.lze-right').getByRole('button', { name: 'Choose from the library' }).click();
    const library = editor.getByRole('dialog', { name: 'Images' });
    await library.locator('input[type=file]').setInputFiles({ name: 'hero.png', mimeType: 'image/png', buffer: photo() });
    await library.getByRole('button', { name: 'Use hero.png' }).click();

    await editor.getByRole('tab', { name: 'Layers' }).click();
    await editor.locator('.lze-left').getByRole('button', { name: 'New' }).click();
    await editor.getByRole('tab', { name: 'Elements' }).click();
    await editor.locator('.lze-palette-item', { hasText: 'Latest posts' }).click();
    await expect(canvas.locator('.lz-el[data-type=latest_posts] li')).toHaveCount(3);
    await expect(page.getByTestId('save-status')).toHaveText(/Draft saved/, { timeout: 10_000 });
    await expect(editor.getByText('Page created.')).toBeHidden({ timeout: 10_000 });
    await canvas.locator('section.lz-section').nth(3).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(docs, 'editor.png') });

    await editor.getByRole('button', { name: 'Publish' }).click();
    await expect(editor.locator('.lze-badge-status')).toHaveText('Published');
    await page.goto('/');
    await expect.poll(() => page.locator('img.lz-el').first().evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(docs, 'page.png') });
});
