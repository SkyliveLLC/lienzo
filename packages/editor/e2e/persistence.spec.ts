import { desktopBox, expect, test } from './fixtures.ts';

test('autosaves, and a reload shows the change', async ({ editor, page }) => {
    const button = editor.canvas.locator('section.lz-section').first().locator('a.lz-el');
    // 80px down lands the button's edges away from every snapping guide.
    await editor.drag(await editor.center(button), { x: 0, y: 80 });
    await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes');
    await editor.waitForSave();

    await page.reload();
    await expect(editor.canvas.locator('section.lz-section').first()).toBeVisible();
    expect(desktopBox(await editor.draft(), 0, 'button')?.y).toBe(536);
    const moved = await button.evaluate((node) => getComputedStyle(node).getPropertyValue('--y').trim());
    expect(moved).toBe('536');
});

test('a stale save is refused and the editor offers to reload', async ({ editor, page, browser }) => {
    const other = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await other.goto('/');
    const otherHeading = other.frameLocator('iframe.lze-frame').locator('h1.lz-el');
    await expect(otherHeading).toBeVisible();

    // This tab saves first.
    await editor.canvas.locator('h1.lz-el').click();
    await page.keyboard.press('ArrowDown');
    await editor.waitForSave();

    // The other tab is now stale.
    await otherHeading.click();
    await other.keyboard.press('ArrowRight');
    await expect(other.getByTestId('save-status')).toHaveText('This page was changed somewhere else');
    await expect(other.getByRole('dialog')).toContainText('This page changed somewhere else');
    await other.getByRole('dialog').getByRole('button', { name: 'Reload the page' }).click();

    await expect(other.getByTestId('save-status')).toHaveText('Changes save automatically');
    expect(desktopBox(await editor.draft(), 0, 'heading')?.y).toBe(141);
    await other.close();
});

test('shows when it cannot save while offline and catches up after', async ({ editor, page, context }) => {
    await context.setOffline(true);
    await editor.canvas.locator('h1.lz-el').click();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('save-status')).toHaveText(/offline/);

    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    // Back online, it saves by itself.
    await context.setOffline(false);
    await editor.waitForSave();
    expect(desktopBox(await editor.draft(), 0, 'heading')?.y).toBe(141);
});
