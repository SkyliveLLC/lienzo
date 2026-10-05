import { expect, test, type Locator, type Page } from '@playwright/test';

/** A 1x1 PNG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const cssVar = (node: Element, name: string): number => Number(getComputedStyle(node).getPropertyValue(name));

/** Drags by screen pixels in small steps, like a hand. */
async function drag(page: Page, target: Locator, dx: number, dy: number): Promise<void> {
    const box = await target.boundingBox();
    if (!box) {
        throw new Error('Not visible');
    }
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
}

test('an editor builds and publishes a page, and a visitor reads it and writes back', async ({ page, browser, request, baseURL }) => {
    const errors: Error[] = [];
    page.on('pageerror', (error) => errors.push(error));

    expect((await request.get('/')).status()).toBe(404);
    expect(await (await request.get('/robots.txt')).text()).not.toContain('Sitemap:');

    await page.goto('/admin');
    const editor = page.locator('lienzo-editor');
    const canvas = page.frameLocator('lienzo-editor >> iframe.lze-frame');
    const panel = editor.locator('.lze-right');
    const saved = () => expect(editor.getByTestId('save-status')).toHaveText(/Draft saved/, { timeout: 10_000 });

    // No pages yet, so the editor asks for the first one. An empty address is the home page.
    const dialog = editor.getByRole('dialog', { name: 'New page' });
    await dialog.getByLabel('Title').fill('Home');
    await dialog.getByRole('button', { name: 'Create page' }).click();
    await expect(canvas.locator('section.lz-section')).toHaveCount(1);

    await editor.locator('.lze-list-item', { hasText: 'Contact form' }).click();
    await expect(canvas.locator('section.lz-section')).toHaveCount(2);

    const first = canvas.locator('section.lz-section').first();
    await first.click({ position: { x: 4, y: 4 } });
    await editor.locator('.lze-palette-item', { hasText: /^Heading$/ }).click();
    const heading = first.locator('h1.lz-el');
    await expect(heading).toHaveText('A heading that invites people in');

    const before = await heading.evaluate(cssVar, '--y');
    await drag(page, heading, 0, 60);
    await expect.poll(() => heading.evaluate(cssVar, '--y')).toBeGreaterThan(before + 30);

    await heading.dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Welcome to the studio');
    await page.keyboard.press('Enter');
    await expect(heading).toHaveText('Welcome to the studio');

    await editor.getByRole('tab', { name: 'Media' }).click();
    await editor.locator('.lze-left').getByRole('button', { name: 'Upload' }).click();
    const library = editor.getByRole('dialog', { name: 'Images' });
    await library.locator('input[type=file]').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    await library.getByRole('button', { name: 'Use dot.png' }).click();
    await expect(first.locator('img.lz-el[src^="/api/media/"]')).toHaveCount(1);

    const frame = editor.locator('iframe.lze-frame');
    await editor.getByRole('button', { name: 'Phone', exact: true }).click();
    await expect(frame).toHaveJSProperty('offsetWidth', 390);
    await editor.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(frame).toHaveJSProperty('offsetWidth', 1200);

    await editor.getByRole('tab', { name: 'Elements' }).click();
    await editor.locator('.lze-palette-item', { hasText: 'Latest posts' }).click();
    const posts = first.locator('.lz-el[data-type=latest_posts]');
    await expect(posts).toContainText('Open day on October 18');
    await panel.getByLabel('Heading', { exact: true }).fill('From the blog');
    await panel.getByLabel('Heading', { exact: true }).blur();
    await expect(posts.locator('h3')).toHaveText('From the blog');

    await editor.locator('.lze-palette-item', { hasText: /^Button$/ }).click();
    await panel.getByLabel('Action', { exact: true }).selectOption({ label: 'Call the site phone' });

    await saved();
    await editor.getByRole('button', { name: 'Publish' }).click();
    await expect(editor.locator('.lze-badge-status')).toHaveText('Published');

    const guest = await browser.newContext({ baseURL });
    const visitor = await guest.newPage();
    await visitor.goto('/');
    await expect(visitor.locator('h1.lz-el')).toHaveText('Welcome to the studio');
    const image = visitor.locator('img.lz-el');
    await expect(image).toHaveAttribute('src', /\/media\/\d+$/);
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
    await expect(visitor.locator('a.lz-el', { hasText: 'Get started' })).toHaveAttribute('href', 'tel:+15550100');

    const live = visitor.locator('.lz-el[data-type=latest_posts]');
    await expect(live.locator('h3')).toHaveText('From the blog');
    await expect(live.locator('li').first()).toContainText('Open day on October 18');
    expect((await request.post('/admin/posts', { data: { title: 'Fresh from the server' } })).status()).toBe(201);
    await visitor.reload();
    await expect(live.locator('li').first()).toContainText('Fresh from the server');

    const form = visitor.locator('form', { has: visitor.locator('input[type=email]') });
    await form.getByLabel('Name').fill('Ada Lovelace');
    await form.getByLabel('Email').fill('ada@example.com');
    await form.getByLabel('Topic').selectOption('Pricing');
    await form.getByLabel('Message').fill('Do you run evening classes?');
    await form.getByLabel('I agree to be contacted').check();
    const fields = await form.evaluate((node: HTMLFormElement) => [...new FormData(node)].map(([name, value]) => [name, String(value)]));
    const emailName = await form.locator('input[type=email]').getAttribute('name');
    await form.getByRole('button', { name: 'Send' }).click();
    await visitor.waitForURL(/\/\?sent$/);
    await expect(visitor.locator('.lz-notice')).toHaveText('Thanks, your message was sent.');

    // The browser checks fields before posting; the server checks them again, whatever arrives.
    const forged = await request.post('/submit', {
        form: Object.fromEntries(fields.map(([name, value]) => [name, name === emailName ? 'not-an-email' : value])),
        maxRedirects: 0,
    });
    expect(forged.status()).toBe(422);
    expect(await forged.text()).toContain('Email must be an email address.');
    await guest.close();

    await editor.getByRole('button', { name: 'Messages' }).click();
    const messages = editor.getByRole('dialog', { name: 'Form messages' });
    await expect(messages.locator('.lze-submission')).toHaveCount(1);
    await expect(messages).toContainText('Ada Lovelace');
    await expect(messages).toContainText('Do you run evening classes?');

    expect(await (await request.get('/sitemap.xml')).text()).toContain(`<loc>${baseURL}</loc>`);
    expect(await (await request.get('/robots.txt')).text()).toContain(`Sitemap: ${baseURL}sitemap.xml`);
    expect(errors).toEqual([]);
});
