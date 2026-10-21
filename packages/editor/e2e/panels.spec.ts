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

    const size = panel.getByRole('spinbutton', { name: /^Size\b/ }).first();

    await size.fill('60');
    await size.blur();
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
    await expect(dialog.locator('.lze-submission dd:last-of-type')).toHaveText(['Yes', 'No']);

    await dialog.getByRole('button', { name: 'Load more' }).click();
    await expect(dialog.locator('.lze-submission')).toHaveCount(3);
    await expect(dialog.getByRole('button', { name: 'Load more' })).toBeHidden();
});

test('a style change with several selected reaches all of them', async ({ editor, page }) => {
    const heading = editor.canvas.locator('h1.lz-el');
    const text = editor.canvas.locator('section.lz-section').first().locator('p.lz-el');

    await heading.click();
    await text.click({ modifiers: ['Shift'] });

    // Only what both understand is offered, and it writes to both.
    await page.getByRole('button', { name: 'Right', exact: true }).click();
    await editor.waitForSave();

    const styled = (await editor.draft()).sections[0]!.elements;
    expect(styled.find((element) => element.type === 'heading')?.style.align).toBe('right');
    expect(styled.find((element) => element.type === 'text')?.style.align).toBe('right');

    // Order applies to the whole selection too, keeping how they sat between them.
    await heading.click({ button: 'right' });
    await page.locator('.lze-context').getByRole('menuitem', { name: 'Bring to front' }).click();
    await editor.waitForSave();

    const layered = (await editor.draft()).sections[0]!.elements;
    const top = Math.max(...layered.filter((element) => element.type !== 'heading' && element.type !== 'text').map((element) => element.z));
    expect(layered.find((element) => element.type === 'heading')!.z).toBeGreaterThan(top);
    expect(layered.find((element) => element.type === 'text')!.z).toBeGreaterThan(top);
});

test('a section can lay itself out, and then nothing is dragged in it', async ({ editor, page }) => {
    const panel = page.locator('.lze-right');

    // With a phone layout of its own, the section still has to flow on phones.
    await page.getByRole('button', { name: 'Phone', exact: true }).click();
    await page.locator('.lze-stacked').first().getByRole('button', { name: 'Generate phone layout' }).click();
    await editor.waitForSave();
    await page.getByRole('button', { name: 'Desktop', exact: true }).click();

    await editor.canvas.locator('section.lz-section').first().click({ position: { x: 4, y: 4 } });
    await panel.getByLabel('Lay it out').selectOption({ label: 'Side by side' });

    const gap = panel.getByRole('spinbutton', { name: /^Space between/ });

    await gap.fill('40');
    await gap.blur();
    await editor.waitForSave();

    const section = (await editor.draft()).sections[0]!;

    expect(section.flow).toBe('row');
    expect(section.flow_gap).toBe(40);

    const frame = editor.canvas.locator('section.lz-section').first().locator('.lz-frame');

    await expect(frame).toHaveAttribute('data-flow', 'row');
    await expect(frame).toHaveCSS('flex-direction', 'row');

    // The canvas says so, and a drag inside it changes nothing.
    await expect(page.locator('.lze-stacked')).toBeVisible();
    const before = await editor.draft();
    const heading = editor.canvas.locator('h1.lz-el, h2.lz-el').first();

    await editor.drag(await editor.center(heading), { x: 120, y: 60 });
    expect(await editor.draft()).toEqual(before);

    // Published and seen on a phone, it keeps laying itself out: one column, nothing piled up.
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.lze-badge-status')).toHaveText('Published');
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/site/');

    const published = page.locator('.lz-frame[data-flow]').first();

    await expect(published).toHaveCSS('flex-direction', 'column');

    const tops = await published.locator('> .lz-el').evaluateAll(
        (nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );

    expect(tops.length).toBeGreaterThan(1);
    expect(new Set(tops).size).toBe(tops.length);
});

test('a gallery takes pictures from the library and shows them in a row', async ({ editor, page }) => {
    await page.locator('.lze-palette-item', { hasText: /^Gallery$/ }).click();

    const panel = page.locator('.lze-right');

    for (const [index, address] of ['https://images.example.com/una.jpg', 'https://images.example.com/otra.jpg'].entries()) {
        await panel.getByRole('button', { name: 'Add a picture' }).click();

        const slot = panel.getByRole('group', { name: `Picture ${index + 1}` }).getByLabel('or paste an https:// address');

        await slot.fill(address);
        await slot.blur();
    }
    await editor.waitForSave();

    const gallery = editor.canvas.locator('div.lz-gallery').first();

    await expect(gallery.locator('img.lz-gallery-item')).toHaveCount(2);
    await expect(gallery).toHaveAttribute('data-layout', 'grid');

    await panel.getByLabel('Shown as').selectOption({ label: 'Strip that scrolls' });
    await expect(gallery).toHaveAttribute('data-layout', 'strip');
    await editor.waitForSave();

    const element = (await editor.draft()).sections[0]!.elements.find((item) => item.type === 'gallery');

    expect(element?.props.images).toEqual(['https://images.example.com/una.jpg', 'https://images.example.com/otra.jpg']);
    expect(element?.props.layout).toBe('strip');
});

test('a slider takes pictures, and says how the reader moves it', async ({ editor, page }) => {
    await page.locator('.lze-palette-item', { hasText: /^Slider$/ }).click();

    const panel = page.locator('.lze-right');

    for (const [index, address] of ['https://images.example.com/una.jpg', 'https://images.example.com/otra.jpg'].entries()) {
        await panel.getByRole('button', { name: 'Add a picture' }).click();

        const slot = panel.getByRole('group', { name: `Picture ${index + 1}` }).getByLabel('or paste an https:// address');

        await slot.fill(address);
        await slot.blur();
    }

    const slider = editor.canvas.locator('div.lz-slider').first();

    await expect(slider.locator('img.lz-slide')).toHaveCount(2);
    await expect(slider.locator('.lz-slider-arrow')).toHaveCount(2);
    await expect(slider.locator('.lz-slider-dots button')).toHaveCount(2);

    await panel.getByLabel('Dots under it').uncheck();
    await expect(slider.locator('.lz-slider-dots')).toHaveCount(0);

    await panel.getByLabel('Move by itself').check();
    await panel.getByRole('spinbutton', { name: 'Seconds on each picture' }).fill('8');
    await panel.getByRole('spinbutton', { name: 'Seconds on each picture' }).blur();
    await editor.waitForSave();

    // It keeps the height its box gives it, instead of filling the whole section.
    const measured = await slider.evaluate((node) => ({
        height: Math.round(node.getBoundingClientRect().height),
        frame: Math.round(node.closest('.lz-frame')!.getBoundingClientRect().height),
    }));

    expect(measured.height).toBeGreaterThan(0);
    expect(measured.height).toBeLessThan(measured.frame * 0.9);

    const element = (await editor.draft()).sections[0]!.elements.find((item) => item.type === 'slider');

    expect(element?.props.images).toHaveLength(2);
    expect(element?.props.dots).toBe(false);
    expect(element?.props.autoplay).toBe(true);
    expect(element?.props.interval).toBe(8);
});

test('the block library is grouped, and a block lands as a real section', async ({ editor, page }) => {
    const sidebar = page.locator('.lze-left');

    await sidebar.getByRole('tab', { name: 'Blocks' }).click();
    await expect(sidebar.locator('.lze-group-label')).toHaveCount(4);
    await expect(sidebar.getByRole('button', { name: 'Plans' })).toBeVisible();

    const before = (await editor.draft()).sections.length;

    await sidebar.getByRole('button', { name: 'Plans' }).click();
    await editor.waitForSave();

    const sections = (await editor.draft()).sections;

    expect(sections).toHaveLength(before + 1);
    expect(sections.at(-1)!.elements.filter((element) => element.type === 'button')).toHaveLength(3);

    await sidebar.getByRole('button', { name: 'Numbers' }).click();
    await editor.waitForSave();

    expect((await editor.draft()).sections.at(-1)!.flow).toBe('row');
});

test('a text keeps the line breaks its author typed', async ({ editor, page }) => {
    await page.locator('.lze-palette-item', { hasText: /^Text$/ }).click();
    await page.locator('.lze-right').getByRole('textbox', { name: 'Text', exact: true }).fill('Una\nDos');
    await editor.waitForSave();

    const paragraph = editor.canvas.locator('p.lz-el', { hasText: 'Una' }).first();

    // The rule is what keeps the break: without it the browser folds both lines into one.
    await expect(paragraph).toHaveCSS('white-space', 'pre-line');
    expect((await editor.draft()).sections[0]!.elements.at(-1)!.props.text).toBe('Una\nDos');
});
