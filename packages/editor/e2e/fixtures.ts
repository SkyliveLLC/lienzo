import { test as base, expect, type APIRequestContext, type FrameLocator, type Locator, type Page } from '@playwright/test';
import type { Box, Document } from '@skylivellc/lienzo-core';
import type { PageState } from '@skylivellc/lienzo-core/protocol';

/** The editor on the dev harness, with helpers that speak in design units. */
export class EditorPage {
    readonly canvas: FrameLocator;
    readonly frame: Locator;

    constructor(readonly page: Page, private readonly api: APIRequestContext) {
        this.canvas = page.frameLocator('iframe.lze-frame');
        this.frame = page.locator('iframe.lze-frame');
    }

    /** Screen pixels per design pixel: the canvas is a 1200px (or 390px) frame scaled to fit. */
    async scale(): Promise<number> {
        const box = await this.frame.boundingBox();
        const width = await this.frame.evaluate((node) => (node as HTMLIFrameElement).offsetWidth);

        return (box?.width ?? 1) / width;
    }

    /** The page as the backend stored it. */
    async saved(id = 1): Promise<PageState> {
        return (await (await this.api.get(`/api/pages/${id}`)).json()) as PageState;
    }

    async draft(id = 1): Promise<Document> {
        return (await this.saved(id)).draft;
    }

    async waitForSave(): Promise<void> {
        await expect(this.page.getByTestId('save-status')).toHaveText(/Draft saved|Borrador guardado/, { timeout: 10_000 });
    }

    /** Drags by a delta given in design pixels, in small steps like a hand would. */
    async drag(from: { x: number; y: number }, delta: { x: number; y: number }, during?: () => Promise<void>): Promise<void> {
        const scale = await this.scale();
        await this.page.mouse.move(from.x, from.y);
        await this.page.mouse.down();
        await this.page.mouse.move(from.x + delta.x * scale, from.y + delta.y * scale, { steps: 12 });
        await during?.();
        await this.page.mouse.up();
    }

    async center(locator: Locator): Promise<{ x: number; y: number }> {
        const box = await locator.boundingBox();

        if (!box) {
            throw new Error('Not visible');
        }

        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
}

export const desktopBox = (document: Document, section: number, type: string, index = 0): Box | undefined =>
    document.sections[section]?.elements.filter((element) => element.type === type)[index]?.layout.desktop;

export const test = base.extend<{ editor: EditorPage }>({
    editor: async ({ page, request }, use) => {
        await request.post('/api/__reset');
        page.on('pageerror', (error) => {
            throw error;
        });
        await page.goto('/');
        await expect(page.locator('iframe.lze-frame')).toBeVisible();
        await expect(page.frameLocator('iframe.lze-frame').locator('section.lz-section').first()).toBeVisible();
        await use(new EditorPage(page, request));
    },
});

export { expect };
