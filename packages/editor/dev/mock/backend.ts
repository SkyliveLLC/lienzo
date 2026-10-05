/**
 * An in-memory Lienzo backend implementing the whole editor protocol, for the
 * dev harness and the end-to-end tests. It validates drafts with core exactly
 * like a real backend would (422 with issue paths), answers 409 to stale
 * revisions, and registers one app element (`pricing`), one app action
 * (`book_call`) and a few site fields, so the editor's extension points run.
 */
import {
    DocumentError,
    parseDocument,
    parseSiteSettings,
    renderPage,
    trustedHtml,
    type AppElement,
    type Catalog,
    type Document,
    type FieldValue,
    type Issue,
    type Parsed,
    type SiteSettings,
} from '@skylivellc/lienzo-core';
import type { Asset, PageState, PageVersion, SiteMeta, SiteUpdate, Submission, Workspace } from '@skylivellc/lienzo-core/protocol';
import { buildPageTemplate } from '../../src/model/templates.ts';

export type MockRequest = { method: string; path: string; query: URLSearchParams; json: unknown; file: File | null };
export type MockResponse = { status: number; json?: unknown; bytes?: Uint8Array; type?: string; html?: string };

export const catalog: Catalog = {
    elements: [{
        type: 'pricing',
        label: { en: 'Pricing card', es: 'Tarjeta de precio' },
        icon: 'credit-card',
        fields: [
            { kind: 'text', key: 'plan', label: { en: 'Plan name', es: 'Nombre del plan' }, max: 40, default: 'Pro' },
            { kind: 'number', key: 'price', label: { en: 'Price', es: 'Precio' }, min: 0, max: 9999, step: 1, default: 29 },
            {
                kind: 'choice', key: 'period', label: { en: 'Billed', es: 'Cobro' }, default: 'month',
                options: [{ value: 'month', label: { en: 'Monthly', es: 'Mensual' } }, { value: 'year', label: { en: 'Yearly', es: 'Anual' } }],
            },
            { kind: 'toggle', key: 'featured', label: { en: 'Highlight this plan', es: 'Destacar este plan' }, default: false },
            { kind: 'text', key: 'features', label: { en: 'Features, one per line', es: 'Características, una por línea' }, max: 400, multiline: true, default: 'Unlimited projects\nPriority support' },
            { kind: 'image', key: 'badge', label: { en: 'Badge', es: 'Insignia' } },
            { kind: 'action', key: 'cta', label: { en: 'Button action', es: 'Acción del botón' } },
        ],
        styles: ['fill', 'text', 'border', 'effects', 'motion'],
        size: { w: 30, h: 360 },
        css: '.price{display:flex;flex-direction:column;gap:calc(10 * var(--u));height:100%;padding:calc(24 * var(--u));border-radius:inherit;background:var(--surface)}'
            + '.price.is-featured{background:var(--primary);color:var(--background)}.price strong{font-family:var(--font-heading);font-size:1.2em}'
            + '.price .amount{margin:0;font-size:2.4em;font-weight:700}.price .amount span{font-size:.4em;font-weight:400;opacity:.7}'
            + '.price ul{margin:0;padding-left:1.2em;opacity:.85}.price img{width:calc(48 * var(--u));height:calc(48 * var(--u));object-fit:contain}'
            + '.price .cta{margin-top:auto;padding:calc(10 * var(--u));border-radius:var(--radius);background:var(--background);color:var(--text);text-align:center;font-weight:600}',
    }],
    actions: [{
        type: 'book_call',
        label: { en: 'Book a call', es: 'Agendar una llamada' },
        value: {
            kind: 'choice', key: 'length', label: { en: 'Length', es: 'Duración' }, default: '30',
            options: [{ value: '15', label: { en: '15 minutes', es: '15 minutos' } }, { value: '30', label: { en: '30 minutes', es: '30 minutos' } }],
        },
    }],
    siteFields: [
        { kind: 'text', key: 'phone', label: { en: 'Phone', es: 'Teléfono' }, max: 40 },
        { kind: 'text', key: 'address', label: { en: 'Address', es: 'Dirección' }, max: 160 },
        { kind: 'text', key: 'hours', label: { en: 'Opening hours', es: 'Horario' }, max: 300, multiline: true },
        { kind: 'toggle', key: 'chat', label: { en: 'Show the chat bubble', es: 'Mostrar la burbuja de chat' }, default: false },
    ],
};

type StoredPage = { id: number; slug: string; title: string; seo: { title: string | null; description: string | null }; draft: Document; revision: number; published: Document | null; publishedAt: string | null; versions: (PageVersion & { content: Document })[] };
type StoredAsset = Asset & { bytes: Uint8Array; type: string };

const SLUG = /^([a-z0-9]+(-[a-z0-9]+)*)?$/;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']);
const MAX_BYTES = 6 * 1024 * 1024;
const QUOTA = 50 * 1024 * 1024;

export function createBackend(options: { publicUrl: string; latency?: number }) {
    let ids = 100;
    let site: Parsed<SiteSettings>;
    let meta: SiteMeta;
    let pages: StoredPage[];
    let assets: StoredAsset[];
    let submissions: Submission[];

    function reset() {
        ids = 100;
        site = parseSiteSettings({ name: 'Acme Studio', locale: 'en' });
        meta = { phone: '+1 555 0100', address: '', hours: '', chat: false };
        const home = (parseDocument({ sections: buildPageTemplate('full') }, catalog));
        pages = [
            { id: 1, slug: '', title: 'Home', seo: { title: null, description: null }, draft: home, revision: 1, published: null, publishedAt: null, versions: [] },
            { id: 2, slug: 'pricing', title: 'Pricing', seo: { title: null, description: null }, draft: withPluginGone(buildPageTemplate('landing')), revision: 1, published: null, publishedAt: null, versions: [] },
        ];
        assets = [];
        submissions = [3, 2, 1].map((n) => ({
            id: n, page: '', source: 'contact', createdAt: new Date(Date.UTC(2026, 0, n, 9)).toISOString(),
            fields: { name: `Visitor ${n}`, message: n === 3 ? 'Do you ship abroad?\nThanks!' : 'Hello', newsletter: n === 3 },
        }));
    }

    reset();

    const workspace = (): Workspace => ({
        site,
        meta,
        publicUrl: options.publicUrl,
        pages: pages.map(({ id, slug, title, publishedAt }) => ({ id, slug, title, publishedAt })),
        catalog,
        assets: assets.map(({ bytes: _bytes, type: _type, ...asset }) => asset),
        quota: { used: assets.reduce((sum, asset) => sum + asset.bytes.length, 0), limit: QUOTA },
    });

    const state = (page: StoredPage): PageState => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        publishedAt: page.publishedAt,
        seo: page.seo,
        draft: page.draft,
        revision: page.revision,
        versions: page.versions.map(({ content: _content, ...version }) => version),
    });

    const ok = (json: unknown, status = 200): MockResponse => ({ status, json });
    const invalid = (issues: Issue[], message = 'The given data was invalid.'): MockResponse => ({ status: 422, json: { message, issues } });
    const missing = (): MockResponse => ({ status: 404, json: { message: 'Not found' } });

    const parseDraft = (input: unknown): Document | Issue[] => {
        try {
            return parseDocument(input, catalog);
        } catch (error) {
            if (error instanceof DocumentError) {
                return error.issues.map((issue) => ({ ...issue, path: `draft.${issue.path}` }));
            }

            throw error;
        }
    };

    const record = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

    async function handle(request: MockRequest): Promise<MockResponse> {
        if (options.latency) {
            await new Promise((resolve) => setTimeout(resolve, options.latency));
        }

        const { method, path } = request;
        const body = record(request.json);
        const route = `${method} ${path.replace(/\/\d+/g, '/:n')}`;
        const numbers = [...path.matchAll(/\/(\d+)/g)].map((match) => Number(match[1]));
        const page = pages.find((candidate) => candidate.id === numbers[0]);

        switch (route) {
            case 'POST /__reset':
                reset();

                return ok(null);
            case 'GET /':
                return ok(workspace());
            case 'PUT /site': {
                const update = body as SiteUpdate;

                try {
                    site = parseSiteSettings({
                        ...site,
                        theme: { ...site.theme, ...update.theme },
                        ...(update.seo !== undefined ? { seo: update.seo } : {}),
                        ...(update.locale !== undefined ? { locale: update.locale } : {}),
                        ...(update.favicon !== undefined ? { favicon: update.favicon } : {}),
                        ...(update.og_image !== undefined ? { og_image: update.og_image } : {}),
                    });
                } catch (error) {
                    if (error instanceof DocumentError) {
                        return invalid(error.issues);
                    }

                    throw error;
                }

                if (update.meta) {
                    const issues = metaIssues(update.meta);

                    if (issues.length) {
                        return invalid(issues);
                    }

                    meta = { ...meta, ...update.meta };
                }

                return ok(workspace());
            }
            case 'GET /pages/:n':
                return page ? ok(state(page)) : missing();
            case 'POST /pages': {
                const title = String(body.title ?? '').trim();
                const slug = String(body.slug ?? '').trim();
                const issues: Issue[] = [];

                if (title === '') {
                    issues.push({ path: 'title', code: 'required', message: 'The title is required.' });
                }
                if (!SLUG.test(slug) || slug === '') {
                    issues.push({ path: 'slug', code: 'pattern', message: 'Use lowercase letters, numbers and dashes.' });
                } else if (pages.some((candidate) => candidate.slug === slug)) {
                    issues.push({ path: 'slug', code: 'type', message: 'Another page already uses this address.' });
                }
                if (issues.length) {
                    return invalid(issues);
                }

                const created: StoredPage = {
                    id: ++ids, slug, title, seo: { title: null, description: null },
                    draft: { sections: [{ id: `section-${ids}`, height: { desktop: 520, mobile: 560 }, background: { type: 'color', color: 'background' }, elements: [] }] },
                    revision: 1, published: null, publishedAt: null, versions: [],
                };
                pages.push(created);

                return ok(state(created), 201);
            }
            case 'PUT /pages/:n': {
                if (!page) {
                    return missing();
                }
                if (body.baseRevision !== page.revision) {
                    return { status: 409, json: { message: 'This page was saved somewhere else.', revision: page.revision } };
                }

                const draft = body.draft === undefined ? page.draft : parseDraft(body.draft);

                if (Array.isArray(draft)) {
                    return invalid(draft);
                }
                if (body.slug !== undefined && page.slug !== body.slug) {
                    const slug = String(body.slug);

                    if (page.slug === '' || !SLUG.test(slug) || slug === '' || pages.some((candidate) => candidate.slug === slug)) {
                        return invalid([{ path: 'slug', code: 'pattern', message: page.slug === '' ? 'The home page keeps its address.' : 'This address is taken or not valid.' }]);
                    }

                    page.slug = slug;
                }

                page.draft = draft;
                page.title = typeof body.title === 'string' ? body.title : page.title;
                page.seo = body.seo === undefined ? page.seo : (record(body.seo) as StoredPage['seo']);
                page.revision++;

                return ok({ revision: page.revision });
            }
            case 'DELETE /pages/:n':
                if (!page) {
                    return missing();
                }
                if (page.slug === '') {
                    return invalid([{ path: 'slug', code: 'type', message: 'The home page cannot be deleted.' }]);
                }

                pages = pages.filter((candidate) => candidate !== page);

                return { status: 204 };
            case 'POST /pages/:n/publish':
                if (!page) {
                    return missing();
                }
                if (body.revision !== page.revision) {
                    return { status: 409, json: { message: 'This page changed since.', revision: page.revision } };
                }
                if (JSON.stringify(page.published) !== JSON.stringify(page.draft)) {
                    page.published = structuredClone(page.draft);
                    page.publishedAt = new Date().toISOString();
                    page.versions = [{ id: ++ids, createdAt: page.publishedAt, by: 'Dev', content: structuredClone(page.draft) }, ...page.versions];
                }

                return ok(state(page));
            case 'POST /pages/:n/versions/:n/restore': {
                const version = page?.versions.find((candidate) => candidate.id === numbers[1]);

                if (!page || !version) {
                    return missing();
                }

                page.draft = structuredClone(version.content);
                page.revision++;

                return ok(state(page));
            }
            case 'POST /assets': {
                const file = request.file;

                if (!file) {
                    return invalid([{ path: 'file', code: 'required', message: 'Choose a file.' }]);
                }
                if (!ALLOWED.has(file.type)) {
                    return invalid([{ path: 'file', code: 'type', message: 'Use a JPG, PNG, WebP, AVIF or SVG image.' }]);
                }
                if (file.size > MAX_BYTES) {
                    return invalid([{ path: 'file', code: 'size', message: 'The image is larger than 6 MB.' }]);
                }

                const id = ++ids;
                const asset: StoredAsset = {
                    id, ref: `media:${id}`, name: file.name, url: `/api/media/${id}`, thumb: `/api/media/${id}`, width: null, height: null,
                    bytes: new Uint8Array(await file.arrayBuffer()), type: file.type,
                };
                assets.unshift(asset);
                const { bytes: _bytes, type: _type, ...json } = asset;

                return ok(json, 201);
            }
            case 'DELETE /assets/:n':
                assets = assets.filter((asset) => asset.id !== numbers[0]);

                return { status: 204 };
            case 'GET /media/:n': {
                const asset = assets.find((candidate) => candidate.id === numbers[0]);

                return asset ? { status: 200, bytes: asset.bytes, type: asset.type } : missing();
            }
            case 'POST /preview': {
                const elements = Array.isArray(body.elements) ? body.elements.map(record) : [];

                return ok(Object.fromEntries(elements.map((element) => [String(element.id), renderPricing(record(element.props))])));
            }
            case 'GET /submissions': {
                const from = Number(request.query.get('cursor') ?? 0);
                const next = from + 2 < submissions.length ? String(from + 2) : null;

                return ok({ data: submissions.slice(from, from + 2), next });
            }
            default:
                return missing();
        }
    }

    function metaIssues(values: SiteMeta): Issue[] {
        return Object.entries(values).flatMap(([key, value]): Issue[] => {
            const field = catalog.siteFields?.find((candidate) => candidate.key === key);

            if (!field) {
                return [{ path: `meta.${key}`, code: 'type', message: 'Unknown field.' }];
            }
            if (field.kind === 'text' && value !== null && (typeof value !== 'string' || value.length > field.max)) {
                return [{ path: `meta.${key}`, code: 'size', message: `At most ${field.max} characters.` }];
            }
            if (field.kind === 'toggle' && typeof value !== 'boolean') {
                return [{ path: `meta.${key}`, code: 'type', message: 'Must be on or off.' }];
            }

            return [];
        });
    }

    /** The public page, as a real backend serves it: published content through core's renderer. */
    async function publicPage(slug: string): Promise<MockResponse> {
        const page = pages.find((candidate) => candidate.slug === slug);

        if (!page?.published) {
            return { status: 404, html: '<!DOCTYPE html><title>Not published</title><p>This page is not published yet.</p>' };
        }

        const rendered = await renderPage({
            document: parseDocument(page.published, catalog),
            catalog,
            site,
            page: { slug, seo: page.seo, url: new URL(slug, options.publicUrl).href },
            base: new URL(options.publicUrl).pathname.replace(/\/$/, ''),
            mode: 'public',
            host: {
                media: (ref) => {
                    const asset = assets.find((candidate) => candidate.ref === ref);

                    return asset ? { url: asset.url, thumb: null, width: null, height: null } : null;
                },
                action: (action) => (action.type === 'book_call' ? `https://example.com/book?minutes=${encodeURIComponent(action.value ?? '30')}` : null),
                appElement: (element: AppElement) => trustedHtml(renderPricing(element.props)),
                form: null,
            },
        });

        return { status: 200, html: rendered.html };
    }

    return { handle, publicPage, reset };
}

/** An element from a plugin that is no longer installed: the editor must keep it, locked. */
function withPluginGone(sections: Document['sections']): Document {
    sections[0]?.elements.push({
        id: 'legacy-countdown', type: 'countdown', z: 9,
        layout: { desktop: { x: 70, y: 20, w: 24, h: 60 }, mobile: null },
        props: { until: '2030-01-01' }, style: {},
    });

    return { sections };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

function renderPricing(props: Readonly<Record<string, FieldValue | undefined | unknown>>): string {
    const text = (key: string, fallback: string) => (typeof props[key] === 'string' ? (props[key] as string) : fallback);
    const price = typeof props.price === 'number' ? props.price : 0;
    const features = text('features', '').split('\n').map((line) => line.trim()).filter(Boolean);
    const badge = text('badge', '');

    return `<div class="price${props.featured === true ? ' is-featured' : ''}">`
        + (badge.startsWith('https://') ? `<img src="${escape(badge)}" alt="">` : '')
        + `<strong>${escape(text('plan', 'Plan'))}</strong>`
        + `<p class="amount">$${price}<span>/${props.period === 'year' ? 'year' : 'month'}</span></p>`
        + `<ul>${features.map((feature) => `<li>${escape(feature)}</li>`).join('')}</ul>`
        + `<span class="cta">Choose ${escape(text('plan', 'Plan'))}</span></div>`;
}
