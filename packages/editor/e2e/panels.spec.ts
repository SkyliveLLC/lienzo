import { expect, test } from './fixtures.ts';

/** A 1x1 PNG, enough for the backend to accept an upload. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Runs in the page: only its argument crosses over, not this module's scope. */
const cssVar = (node: Element, property: string) => getComputedStyle(node).getPropertyValue(property).trim();

test('edits text and styles from the panel', async ({ editor, page }) => {
    const heading = editor.canvas.locator('h1.lz-el');
    await heading.click();
    const panel = page.locator('.lze-right');

    await panel.getByRole('textbox', { name: 'Text', exact: true }).fill('A sharper headline');
    await expect(heading).toHaveText('A sharper headline');

    await panel.getByLabel('Size').fill('60');
    await panel.getByLabel('Size').blur();
    await expect.poll(() => heading.evaluate(cssVar, '--fs')).toBe('60');

    await panel.getByRole('group', { name: 'Color', exact: true }).getByRole('button', { name: 'Primary' }).click();
    await expect.poll(() => heading.evaluate(cssVar, '--c')).toBe('#2563eb'); // The theme's primary, through var(--primary).

    await editor.waitForSave();
    const saved = (await editor.draft()).sections[0]!.elements.find((element) => element.type === 'heading');
    expect(saved?.props.text).toBe('A sharper headline');
    expect(saved?.style).toMatchObject({ size: 60, color: 'primary' });
});

test('adds an app element and shows the preview its backend renders', async ({ editor, page }) => {
    await page.locator('.lze-palette-item', { hasText: 'Pricing card' }).click();
    const card = editor.canvas.locator('.lz-el[data-type=pricing]');
    await expect(card.locator('.amount')).toContainText('$29');

    const panel = page.locator('.lze-right');
    await panel.getByLabel('Price').fill('49');
    await panel.getByLabel('Price').blur();
    await expect(card.locator('.amount')).toContainText('$49');

    await panel.getByLabel('Highlight this plan').check();
    await expect(card.locator('.price')).toHaveClass(/is-featured/);

    await editor.waitForSave();
    const saved = (await editor.draft()).sections[0]!.elements.find((element) => element.type === 'pricing');
    expect(saved?.props).toMatchObject({ plan: 'Pro', price: 49, featured: true });
});

test('uploads an image to the library and places it', async ({ editor, page }) => {
    await page.getByRole('tab', { name: 'Media' }).click();
    await page.locator('.lze-left').getByRole('button', { name: 'Upload' }).click();
    const library = page.getByRole('dialog', { name: 'Images' });
    await expect(library).toBeVisible();

    await library.locator('input[type=file]').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    await library.getByRole('button', { name: 'Use dot.png' }).click();

    const image = editor.canvas.locator('section.lz-section').first().locator('img.lz-el[src^="/api/media/"]');
    await expect(image).toHaveCount(1);
    await editor.waitForSave();
    const saved = (await editor.draft()).sections[0]!.elements.filter((element) => element.type === 'image').at(-1);
    expect(saved?.props.src).toMatch(/^media:\d+$/);
});

test('publishes, and restores a published version into the draft', async ({ editor, page }) => {
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.lze-badge-status')).toHaveText('Published');
    const published = await page.request.get('/site/');
    expect(await published.text()).toContain('Build something people remember');

    const heading = editor.canvas.locator('h1.lz-el');
    await heading.click();
    await page.locator('.lze-right').getByRole('textbox', { name: 'Text', exact: true }).fill('Draft only');
    await editor.waitForSave();
    // Visitors still see the published copy.
    expect(await (await page.request.get('/site/')).text()).not.toContain('Draft only');

    await page.getByRole('button', { name: 'Versions' }).click();
    await page.getByRole('dialog', { name: 'Published versions' }).getByRole('button', { name: 'Restore' }).click();

    await expect(heading).toHaveText('Build something people remember');
    expect((await editor.draft()).sections[0]!.elements.find((element) => element.type === 'heading')?.props.text).toBe('Build something people remember');
});

test('groups a section as a tab of the previous one', async ({ editor, page }) => {
    await editor.canvas.locator('section.lz-section').nth(1).click({ position: { x: 4, y: 4 } });
    await page.locator('.lze-right').getByLabel('Shown as').selectOption({ label: 'Tab of the previous group' });

    const tabs = editor.canvas.locator('.lz-stack-nav button');
    await expect(tabs).toHaveCount(2);
    await tabs.nth(1).click();
    await expect(editor.canvas.locator('.lz-stack-panel').nth(1)).toHaveAttribute('data-on');
});

test('edits the content of a modal on its own canvas', async ({ editor, page }) => {
    await page.getByRole('tab', { name: 'Modals' }).click();
    await page.locator('.lze-left').getByRole('button', { name: 'New' }).click();
    await expect(page.locator('.lze-modal-banner')).toContainText('Editing the modal "More information"');

    await page.getByRole('tab', { name: 'Elements' }).click();
    await page.locator('.lze-palette-item', { hasText: /^Heading$/ }).click();
    await expect(editor.canvas.locator('dialog.lz-modal[data-lze-open] h1.lz-el')).toHaveCount(1);
    await expect(editor.canvas.locator('section.lz-section').first()).toBeHidden();

    await page.getByRole('button', { name: 'Back to the page' }).click();
    await expect(editor.canvas.locator('section.lz-section').first()).toBeVisible();
    await editor.waitForSave();
    expect((await editor.draft()).modals?.[0]?.elements.map((element) => element.type)).toEqual(['heading']);
});

test('keeps an element from a missing plugin, locked', async ({ editor, page }) => {
    await page.getByLabel('Page being edited').selectOption({ label: 'Pricing /pricing' });
    const placeholder = editor.canvas.locator('.lz-placeholder');
    await expect(placeholder).toBeVisible();

    await placeholder.click();
    await expect(page.locator('.lze-right')).toContainText('cannot be edited');
    await editor.drag(await editor.center(placeholder), { x: 120, y: 120 });

    const element = (await editor.draft(2)).sections[0]!.elements.find((candidate) => candidate.type === 'countdown');
    expect(element?.layout.desktop).toEqual({ x: 70, y: 20, w: 24, h: 60 });
    expect(element?.props).toEqual({ until: '2030-01-01' });
});

test('saves site details the app declared', async ({ editor, page }) => {
    await page.getByRole('button', { name: 'Site', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Site settings' });
    await dialog.getByLabel('Opening hours').fill('Monday to Friday');
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await expect(dialog).toBeHidden();

    const workspace = await (await page.request.get('/api/')).json();
    expect(workspace.meta.hours).toBe('Monday to Friday');
    await expect(editor.frame).toBeVisible();
});

test('reads form messages a page at a time', async ({ editor, page }) => {
    await expect(editor.frame).toBeVisible();
    await page.getByRole('button', { name: 'Messages' }).click();
    const dialog = page.getByRole('dialog', { name: 'Form messages' });
    await expect(dialog.locator('.lze-submission')).toHaveCount(2);
    await expect(dialog).toContainText('Do you ship abroad?');

    await dialog.getByRole('button', { name: 'Load more' }).click();
    await expect(dialog.locator('.lze-submission')).toHaveCount(3);
    await expect(dialog.getByRole('button', { name: 'Load more' })).toBeHidden();
});
