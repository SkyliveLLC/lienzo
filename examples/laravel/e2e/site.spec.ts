import { execFileSync } from 'node:child_process';
import { expect, test, type Locator, type Page } from '@playwright/test';

/** An 8x8 blue PNG: tiny, but a real image the package decodes and re-encodes. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAFElEQVQImWNUTX7NgA0wYRUdtBIAJUMBg99W0X8AAAAASUVORK5CYII=', 'base64');

const artisan = (...args: string[]) => execFileSync('php', ['artisan', ...args], { cwd: import.meta.dirname + '/..' }).toString();

async function center(locator: Locator): Promise<{ x: number; y: number }> {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();

    return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function waitForSave(page: Page): Promise<void> {
    await expect(page.getByTestId('save-status')).toHaveText(/Draft saved/, { timeout: 10_000 });
}

test('an admin builds and publishes a page, and a guest uses it', async ({ page, browser }) => {
    page.on('pageerror', (error) => {
        throw error;
    });
    const writes: Record<string, string>[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/admin/site/') && request.method() !== 'GET') {
            writes.push(request.headers());
        }
    });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const editor = page.locator('lienzo-editor');
    const canvas = page.frameLocator('lienzo-editor >> iframe.lze-frame');

    // A new site has no pages: the editor asks for the first one.
    const newPage = editor.getByRole('dialog', { name: 'New page' });
    await newPage.getByLabel('Title').fill('Home');
    await newPage.getByRole('button', { name: 'Create page' }).click();
    await expect(canvas.locator('section.lz-section')).toHaveCount(1);

    await editor.locator('.lze-palette-item', { hasText: /^Heading$/ }).click();
    const heading = canvas.locator('section.lz-section').first().locator('h1.lz-el');
    await expect(heading).toHaveCount(1);

    await heading.dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Built with Lienzo');
    await page.keyboard.press('Enter');
    await expect(heading).toHaveText('Built with Lienzo');
    await waitForSave(page);

    // Drag the heading 120 design pixels down; the frame is scaled to fit, so measure the scale first.
    const frame = editor.locator('iframe.lze-frame');
    const scale = (await frame.boundingBox())!.width / (await frame.evaluate((node) => (node as HTMLIFrameElement).offsetWidth));
    const yBefore = Number(await heading.evaluate((node) => getComputedStyle(node).getPropertyValue('--y')));
    const start = await center(heading);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 3 * scale, start.y + 120 * scale, { steps: 12 });
    await page.mouse.up();
    await waitForSave(page);
    await expect.poll(async () => Number(await heading.evaluate((node) => getComputedStyle(node).getPropertyValue('--y')))).toBeGreaterThan(yBefore + 100);

    // Upload an image through the media library and place it.
    await editor.getByRole('tab', { name: 'Media' }).click();
    await editor.locator('.lze-left').getByRole('button', { name: 'Upload' }).click();
    const library = editor.getByRole('dialog', { name: 'Images' });
    await library.locator('input[type=file]').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: PNG });
    await library.getByRole('button', { name: 'Use dot.png' }).click();
    const image = canvas.locator('img.lz-el');
    await expect(image).toHaveCount(1);
    await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await editor.getByRole('tab', { name: 'Elements' }).click();

    // The app element: its preview is rendered by the app, with live posts.
    await canvas.locator('section.lz-section').first().click({ position: { x: 4, y: 4 } });
    await editor.locator('.lze-palette-item', { hasText: 'Latest posts' }).click();
    const posts = canvas.locator('.lz-el[data-type=latest_posts]');
    await expect(posts.locator('li')).toHaveCount(3);
    await editor.locator('.lze-right').getByLabel('How many').fill('2');
    await editor.locator('.lze-right').getByLabel('How many').blur();
    await expect(posts.locator('li')).toHaveText(['What we learned this month', 'Shipping the first version']);

    // The app's action on a button, calling the number set once in the site settings.
    await editor.getByRole('button', { name: 'Site', exact: true }).click();
    const settings = editor.getByRole('dialog', { name: 'Site settings' });
    await settings.getByLabel('Phone number').fill('+1 (555) 0100');
    await settings.getByRole('button', { name: 'Save settings' }).click();
    await expect(settings).toBeHidden();
    await canvas.locator('section.lz-section').first().click({ position: { x: 4, y: 4 } });
    await editor.locator('.lze-palette-item', { hasText: /^Button$/ }).click();
    await editor.locator('.lze-right').getByLabel('Action').selectOption({ label: 'Call us' });

    // A contact form from the ready-made sections.
    await editor.locator('.lze-list-item', { hasText: 'Contact form' }).click();
    await expect(canvas.locator('section.lz-section')).toHaveCount(2);
    await waitForSave(page);

    // The phone frame stacks the desktop layout until the section gets its own.
    await editor.getByRole('button', { name: 'Phone', exact: true }).click();
    await expect(frame).toHaveJSProperty('offsetWidth', 390);
    await editor.locator('.lze-stacked').first().getByRole('button', { name: 'Generate phone layout' }).click();
    await waitForSave(page);
    await editor.getByRole('button', { name: 'Desktop', exact: true }).click();
    await expect(frame).toHaveJSProperty('offsetWidth', 1200);

    await editor.getByRole('button', { name: 'Publish' }).click();
    await expect(editor.locator('.lze-badge-status')).toHaveText('Published');

    // Every editor write echoed Laravel's XSRF cookie; a write without it is refused.
    expect(writes.length).toBeGreaterThan(5);
    expect(writes.every((headers) => (headers['x-xsrf-token'] ?? '').length > 0)).toBe(true);
    const forged = await page.request.put('/admin/site/1/pages/1', { data: { baseRevision: 1 }, headers: { Accept: 'application/json' } });
    expect(forged.status()).toBe(419);

    // A visitor with no session sees the published page.
    const guest = await browser.newContext();
    const visitor = await guest.newPage();
    visitor.on('pageerror', (error) => {
        throw error;
    });
    await visitor.goto('/');
    await expect(visitor.locator('h1.lz-el')).toHaveText('Built with Lienzo');
    await expect(visitor.locator('img.lz-el')).toHaveAttribute('src', /\/lienzo\/media\/\d+$/);
    await expect.poll(() => visitor.locator('img.lz-el').evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(visitor.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', 'tel:+15550100');

    // The posts are read on every request: a new post shows without publishing again.
    const visitorPosts = visitor.locator('.lz-el[data-type=latest_posts] li');
    await expect(visitorPosts).toHaveText(['What we learned this month', 'Shipping the first version']);
    artisan('tinker', '--execute', 'App\\Models\\Post::create(["title" => "Fresh off the press"]);');
    await visitor.reload();
    await expect(visitorPosts).toHaveText(['Fresh off the press', 'What we learned this month']);
    expect((await visitor.request.get('/no-such-page')).status()).toBe(404);

    // The contact form posts form-encoded, with Laravel's CSRF token, and confirms.
    await visitor.getByLabel('Name').fill('Ada Lovelace');
    await visitor.getByLabel('Email').fill('ada@example.com');
    await visitor.getByLabel('Topic').selectOption('Pricing');
    await visitor.getByLabel('Message').fill('Do you have a plan for teams?');
    await visitor.getByLabel('I agree to be contacted about my request').check();
    const [submit] = await Promise.all([
        visitor.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/lienzo/submit')),
        visitor.getByRole('button', { name: 'Send' }).click(),
    ]);
    expect(submit.headers()['content-type']).toBe('application/x-www-form-urlencoded');
    await expect(visitor.locator('.lz-notice')).toHaveText('Thanks! We received your message.');

    const sitemap = await (await visitor.request.get('/sitemap.xml')).text();
    expect(sitemap).toMatch(/<loc>http:\/\/127\.0\.0\.1:8124\/?<\/loc>/);
    const robots = await visitor.request.get('/robots.txt');
    expect(await robots.text()).toContain('Sitemap: http://127.0.0.1:8124/sitemap.xml');
    await guest.close();

    // Back in the editor, the message is there.
    await editor.getByRole('button', { name: 'Messages' }).click();
    const messages = editor.getByRole('dialog', { name: 'Form messages' });
    await expect(messages.locator('.lze-submission')).toHaveCount(1);
    await expect(messages).toContainText('Ada Lovelace');
    await expect(messages).toContainText('Do you have a plan for teams?');
});
