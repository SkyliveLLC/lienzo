import { desktopBox, expect, test, type EditorPage } from './fixtures.ts';

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

test.describe('an edit made just before leaving is kept', () => {
    async function nudgeHeading(editor: EditorPage) {
        await editor.canvas.locator('h1.lz-el').click();
        await editor.page.keyboard.press('ArrowDown');
        await expect(editor.page.getByTestId('save-status')).toHaveText(/Unsaved changes|Cambios sin guardar/);
        await editor.page.waitForTimeout(300);
    }

    const headingY = async (editor: EditorPage) => desktopBox(await editor.draft(), 0, 'heading')?.y;

    test('when the host removes the editor', async ({ editor, page }) => {
        await page.goto('/standalone.html');
        await expect(editor.canvas.locator('h1.lz-el')).toBeVisible();
        await nudgeHeading(editor);
        await page.locator('lienzo-editor').evaluate((node) => node.remove());

        await expect.poll(() => headingY(editor)).toBe(141);
    });

    test('when the page navigates away', async ({ editor, page }) => {
        await nudgeHeading(editor);
        await page.goto('about:blank');

        await expect.poll(() => headingY(editor)).toBe(141);
    });

    test('when the tab closes, without asking first', async ({ editor, page }) => {
        await nudgeHeading(editor);
        await page.close({ runBeforeUnload: true });

        await expect.poll(() => page.isClosed()).toBe(true);
        await expect.poll(() => headingY(editor)).toBe(141);
    });

    test('asks first when the draft is too big to send on the way out', async ({ editor, page, request }) => {
        await request.put('/api/pages/1', { data: { baseRevision: 1, seo: { title: null, description: 'x'.repeat(70_000) } } });
        await page.reload();
        await expect(editor.canvas.locator('h1.lz-el')).toBeVisible();
        await nudgeHeading(editor);

        const dialog = page.waitForEvent('dialog');
        await page.close({ runBeforeUnload: true });
        expect((await dialog).type()).toBe('beforeunload');
        await (await dialog).dismiss();

        expect(page.isClosed()).toBe(false);
        await editor.waitForSave();
        expect(await headingY(editor)).toBe(141);
    });
});
