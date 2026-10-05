import { desktopBox, expect, test } from './fixtures.ts';

test('renders the page through core, with the same markup as the public page', async ({ editor }) => {
    await expect(editor.canvas.locator('section.lz-section')).toHaveCount(5);
    await expect(editor.canvas.locator('h1.lz-el')).toHaveText('Build something people remember');
    // No runtime and no entrance animations while editing.
    await expect(editor.canvas.locator('script')).toHaveCount(0);
});

test('adds every core element type to the selected section', async ({ editor, page }) => {
    const before = (await editor.draft()).sections[0]!.elements.length;
    const labels = ['Heading', 'Text', 'Image', 'Button', 'Divider', 'Video', 'Shape', 'Icon', 'Navigation bar', 'Text field', 'Long text field', 'Dropdown', 'Checkbox'];

    for (const label of labels) {
        await page.locator('.lze-palette-item', { hasText: new RegExp(`^${label}$`) }).click();
    }

    const first = editor.canvas.locator('section.lz-section').first();
    await expect(first.locator('.lz-el')).toHaveCount(before + labels.length);
    for (const selector of ['hr.lz-divider', 'div.lz-video', 'div[data-shape=rectangle]', 'span.lz-icon svg', 'nav.lz-navbar', 'label.lz-field input[type=text]', 'label.lz-field textarea', 'label.lz-field select', 'input[type=checkbox]']) {
        await expect(first.locator(selector).first()).toBeAttached();
    }

    await editor.waitForSave();
    const types = (await editor.draft()).sections[0]!.elements.slice(before).map((element) => element.type);
    expect(types).toEqual(['heading', 'text', 'image', 'button', 'divider', 'video', 'shape', 'icon', 'navbar', 'input', 'textarea', 'select', 'checkbox']);
});

test('drags an element and snaps it to the edge of another', async ({ editor, page }) => {
    const text = editor.canvas.locator('section.lz-section').first().locator('p.lz-el');
    const start = await editor.center(text);

    // The text starts at x 6% (72px); 532px right puts its left edge 6px from the image's left edge (600px).
    await editor.drag(start, { x: 532, y: 0 }, async () => {
        await expect(page.locator('.lze-guide[data-axis=x]')).toBeVisible();
    });

    await editor.waitForSave();
    expect(desktopBox(await editor.draft(), 0, 'text')?.x).toBe(50);
});

test('resizes from a corner handle on the 4px grid', async ({ editor, page }) => {
    const heading = editor.canvas.locator('h1.lz-el');
    await heading.click();
    const handle = page.getByRole('button', { name: 'Resize (se)' });
    await editor.drag(await editor.center(handle), { x: 60, y: 41 });

    await editor.waitForSave();
    expect(desktopBox(await editor.draft(), 0, 'heading')).toEqual({ x: 6, y: 140, w: 45, h: 220 });
});

test('the phone frame stacks sections until they get a phone layout', async ({ editor, page }) => {
    await page.getByRole('button', { name: 'Phone', exact: true }).click();

    await expect(editor.frame).toHaveJSProperty('offsetWidth', 390);
    await expect(editor.canvas.locator('section.lz-section').first().locator('.lz-frame')).toHaveAttribute('data-stack');

    await page.locator('.lze-stacked').first().getByRole('button', { name: 'Generate phone layout' }).click();

    await expect(editor.canvas.locator('section.lz-section').first().locator('.lz-frame')).not.toHaveAttribute('data-stack');
    await editor.waitForSave();
    expect((await editor.draft()).sections[0]!.elements.every((element) => element.layout.mobile !== null)).toBe(true);
});

test('edits text in place and undoes it', async ({ editor, page }) => {
    const heading = editor.canvas.locator('h1.lz-el');
    await heading.dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Hello from the canvas');
    await page.keyboard.press('Enter');

    await expect(heading).toHaveText('Hello from the canvas');
    await editor.waitForSave();
    expect((await editor.draft()).sections[0]!.elements.find((element) => element.type === 'heading')?.props.text).toBe('Hello from the canvas');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(heading).toHaveText('Build something people remember');
});
