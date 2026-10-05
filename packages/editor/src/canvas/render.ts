import {
    DocumentError,
    parseDocument,
    renderPage,
    trustedHtml,
    type AppElement,
    type Catalog,
    type Document,
    type Issue,
    type Parsed,
    type RenderedPage,
    type SiteSettings,
} from '@skylive/lienzo-core';
import type { Asset } from '@skylive/lienzo-core/protocol';
import type { Preview } from '../state/previews.ts';

export type RenderContext = {
    catalog: Catalog;
    site: Parsed<SiteSettings>;
    assets: readonly Asset[];
    slug: string;
    publicUrl: string | null;
    preview(element: AppElement): Preview;
    /** Placeholder texts for app elements whose preview is not there yet. */
    labels: { loading: string; failed: string };
};

export type Rendered = { ok: true; page: RenderedPage } | { ok: false; issues: Issue[] };

/**
 * The page through core, exactly as the public page renders it: `edit` for
 * the canvas (no runtime, no entrance animations, placeholders for missing
 * plugins), `public` for the preview. App elements show the HTML the backend
 * rendered for the same props, or a placeholder while it loads. A draft that
 * does not parse reports its issues instead of rendering.
 */
export async function renderDraft(draft: Document, context: RenderContext, mode: 'edit' | 'public'): Promise<Rendered> {
    let document: Parsed<Document>;

    try {
        document = parseDocument(draft, context.catalog);
    } catch (error) {
        if (error instanceof DocumentError) {
            return { ok: false, issues: error.issues };
        }

        throw error;
    }

    const page = await renderPage({
        document,
        catalog: context.catalog,
        site: context.site,
        page: { slug: context.slug, seo: {}, url: new URL(context.slug, context.publicUrl ?? 'https://example.invalid/').href },
        base: '',
        mode,
        host: {
            media: (ref) => {
                const asset = context.assets.find((candidate) => candidate.ref === ref);

                return asset ? { url: asset.url, thumb: asset.thumb, width: asset.width, height: asset.height } : null;
            },
            // App actions resolve on the backend; in the editor their links go nowhere.
            action: () => '#',
            appElement: (element) => {
                const preview = context.preview(element);

                return preview.status === 'ready'
                    ? trustedHtml(preview.html)
                    : trustedHtml(`<div class="lze-app-placeholder" data-status="${preview.status}">${escapeHtml(preview.status === 'loading' ? context.labels.loading : context.labels.failed)}</div>`);
            },
            form: null,
        },
    });

    return { ok: true, page };
}

const ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

/** Core's rule for ids in HTML and CSS, so the canvas finds what it rendered. */
export const domId = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '') || 'x';
