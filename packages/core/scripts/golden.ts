/**
 * Renders every fixtures/render/<name>.json and writes <name>.html and
 * <name>.css next to it. Other backends render the same inputs and must
 * produce the same bytes. The inlined static assets (lienzo.css and
 * runtime.js) are replaced by markers so a stylesheet change does not touch
 * every golden; they are freshness-checked on their own.
 *
 * Host stubs are data in each input: a media map, app action hrefs, form
 * state. App elements render as `<div class="fixture-app">TYPE</div>`.
 *
 * Usage: node scripts/golden.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    parseDocument,
    parseSiteSettings,
    renderPage,
    trustedHtml,
    type AppElement,
    type Catalog,
    type MediaFile,
    type PageInfo,
    type RenderedPage,
    type TrustedHtml,
} from '../src/index.ts';
import { runtimeScript } from '../src/runtime.generated.ts';
import { stylesheet } from '../src/stylesheet.ts';

export const renderFixtures = join(import.meta.dirname, '../../../fixtures/render');

export type FixtureInput = {
    document: unknown;
    site: unknown;
    page: PageInfo;
    base: string;
    mode: 'public' | 'edit';
    host: {
        media: Record<string, MediaFile>;
        actions: Record<string, string>;
        form: {
            action: string;
            csrf: { name: string; value: string } | null;
            old: Record<string, string>;
            errors: Record<string, string>;
            notice: string | null;
        } | null;
        nonce: string | null;
        head: string | null;
    };
};

export const fixtureCatalog = (): Catalog => JSON.parse(readFileSync(join(renderFixtures, 'catalog.json'), 'utf8')) as Catalog;

export const fixtureNames = () => readdirSync(renderFixtures)
    .filter((file) => file.endsWith('.json') && file !== 'catalog.json')
    .map((file) => file.slice(0, -'.json'.length))
    .sort();

export const readFixture = (name: string) => JSON.parse(readFileSync(join(renderFixtures, `${name}.json`), 'utf8')) as FixtureInput;

const fixtureApp = (element: AppElement): TrustedHtml => trustedHtml(`<div class="fixture-app">${element.type}</div>`);

/** Renders a fixture input. `appElement` defaults to the deterministic fixture stub. */
export function renderFixture(input: FixtureInput, appElement: (element: AppElement) => TrustedHtml = fixtureApp): Promise<RenderedPage> {
    const catalog = fixtureCatalog();
    const { host } = input;

    return renderPage({
        document: parseDocument(input.document, catalog),
        catalog,
        site: parseSiteSettings(input.site),
        page: input.page,
        base: input.base,
        mode: input.mode,
        host: {
            media: (ref) => host.media[ref] ?? null,
            action: (action) => host.actions[action.type] ?? null,
            appElement,
            form: host.form && {
                action: host.form.action,
                csrf: host.form.csrf,
                old: (key) => host.form?.old[key] ?? null,
                error: (key) => host.form?.errors[key] ?? null,
                notice: host.form.notice,
            },
            ...(host.nonce ? { nonce: host.nonce } : {}),
            ...(host.head ? { head: trustedHtml(host.head) } : {}),
        },
    });
}

/** The golden pair for a rendered page. */
export function goldens(page: RenderedPage): { html: string; css: string } {
    const html = page.html.replace(`\n${stylesheet}`, '\n/* lienzo.css */\n').replace(`\n${runtimeScript}`, '\n/* runtime.js */\n');

    return { html, css: page.css };
}

if (import.meta.main) {
    for (const name of fixtureNames()) {
        const { html, css } = goldens(await renderFixture(readFixture(name)));
        writeFileSync(join(renderFixtures, `${name}.html`), html);
        writeFileSync(join(renderFixtures, `${name}.css`), css);
    }
}
