/**
 * A complete Lienzo backend on node:http with no framework: the editor
 * protocol under /api, the editor at /admin, and the published site at /.
 * State is one JSON file plus the uploaded files, in a data directory.
 * Nothing here authenticates: put /admin and /api behind your own login.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocumentError, formFields, parseDocument, parseFields, parseSeo, parseSiteSettings, renderPage, trustedHtml } from '@skylive/lienzo-core';
import type { AppElement, Catalog, Document, FormField, Issue, Seo, SiteSettings, TrustedHtml } from '@skylive/lienzo-core';
import type { Asset, PageState, PageSummary, PageVersion, SiteMeta, Submission, Workspace } from '@skylive/lienzo-core/protocol';

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}/`;
const DATA = process.env.LIENZO_DATA ?? join(import.meta.dirname, '.data');
const EDITOR_BUNDLE = fileURLToPath(import.meta.resolve('@skylive/lienzo-editor/standalone'));
const MAX_BODY = 8 * 1024 * 1024;
const UPLOAD_MAX = 5 * 1024 * 1024;
const QUOTA = 100 * 1024 * 1024;
const SLUG = /^([a-z0-9]+(-[a-z0-9]+)*)?$/;
const BLANK: Document = { sections: [{ id: 'start', height: { desktop: 520, mobile: 560 }, background: { type: 'color', color: 'background' }, elements: [] }] };

/** What this app adds to the editor: an element with live data, an action and a site field. */
const catalog: Catalog = {
    elements: [{
        type: 'latest_posts',
        label: { en: 'Latest posts' },
        icon: 'file-text',
        fields: [
            { kind: 'text', key: 'heading', label: { en: 'Heading' }, max: 60, default: 'Latest news' },
            { kind: 'number', key: 'count', label: { en: 'Posts to show' }, min: 1, max: 5, step: 1, default: 3 },
        ],
        styles: ['text', 'fill', 'border'],
        size: { w: 40, h: 200 },
        css: '.posts h3{margin:0 0 .6em;font-family:var(--font-heading)}.posts ul{margin:0;padding:0;list-style:none}'
            + '.posts li{padding:.4em 0;border-top:1px solid color-mix(in srgb,currentColor 15%,transparent)}.posts time{opacity:.6;margin-right:.6em}',
    }],
    actions: [{ type: 'call_us', label: { en: 'Call the site phone' }, value: null }],
    siteFields: [{ kind: 'text', key: 'phone', label: { en: 'Phone' }, max: 40 }],
};

/** The app's own data, newest first. Lienzo never stores it: the element reads it on every render. */
const posts = [{ title: 'Open day on October 18', date: '2026-09-28' }, { title: 'We moved to a bigger studio', date: '2026-09-12' }];

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** The one renderer for the element: the public page and the editor preview both call it. */
function renderPosts(props: AppElement['props']): TrustedHtml {
    const heading = typeof props.heading === 'string' ? props.heading : 'Latest news';
    const items = posts.slice(0, typeof props.count === 'number' ? props.count : 3)
        .map((post) => `<li><time datetime="${post.date}">${post.date}</time>${escapeHtml(post.title)}</li>`);

    return trustedHtml(`<div class="posts"><h3>${escapeHtml(heading)}</h3><ul>${items.join('')}</ul></div>`);
}

type Live = { slug: string; seo: Seo; document: Document; at: string };
type StoredPage = {
    id: number;
    title: string;
    slug: string;
    seo: Seo;
    draft: Document;
    revision: number;
    /** What visitors see: the draft, address and tags as of the last publish. */
    live: Live | null;
    versions: (PageVersion & { document: Document })[];
};
type StoredAsset = { id: number; name: string; type: string; size: number };
type Store = { nextId: number; site: SiteSettings; meta: SiteMeta; pages: StoredPage[]; assets: StoredAsset[]; submissions: Submission[] };

const STORE = join(DATA, 'store.json');
const mediaPath = (id: number): string => join(DATA, 'media', String(id));
mkdirSync(join(DATA, 'media'), { recursive: true });
const store: Store = existsSync(STORE)
    ? (JSON.parse(readFileSync(STORE, 'utf8')) as Store)
    : { nextId: 1, site: parseSiteSettings({ name: 'Example site' }), meta: { phone: '+1 555 0100' }, pages: [], assets: [], submissions: [] };

/**
 * Handlers check, then change the store and save with no `await` in between,
 * so a revision check and its write never interleave with another request.
 * The rename means a crash never leaves half a file.
 */
function save(): void {
    writeFileSync(`${STORE}.tmp`, JSON.stringify(store));
    renameSync(`${STORE}.tmp`, STORE);
}

// Handlers throw a Response to end the request early, from any depth.
const invalid = (issues: Issue[]): Response => Response.json({ message: issues[0]?.message ?? 'Invalid.', issues }, { status: 422 });
const issue = (path: string, code: Issue['code'], message: string): Response => invalid([{ path, code, message }]);
const conflict = (page: StoredPage): Response => Response.json({ message: 'This page was saved somewhere else.', revision: page.revision }, { status: 409 });
const html = (body: string, status = 200): Response => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const redirect = (location: string): Response => new Response(null, { status: 303, headers: { Location: location } });
const file = (path: string, type: string): Response => new Response(readFileSync(path), { headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' } });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const notFound = (): Response => Response.json({ message: 'Not found.' }, { status: 404 });
function found<T>(value: T | undefined): T {
    if (value === undefined) {
        throw notFound();
    }
    return value;
}

/** Runs a core parser and answers 422 with its issues under `prefix`. */
function parsed<T>(prefix: string, parse: () => T): T {
    try {
        return parse();
    } catch (error) {
        if (error instanceof DocumentError) {
            throw invalid(error.issues.map((found) => ({ ...found, path: [prefix, found.path].filter(Boolean).join('.') })));
        }
        throw error;
    }
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)) {
        throw issue('', 'type', 'The body must be a JSON object.');
    }
    return body;
}

const draftOf = (input: unknown): Document => parsed('draft', () => parseDocument(input, catalog));

function titleOf(value: unknown): string {
    if (typeof value !== 'string' || value.trim() === '' || value.length > 120) {
        throw issue('title', 'required', 'Give the page a title of up to 120 characters.');
    }
    return value.trim();
}

/** A slug is taken by another page's draft, or by its live address until that page publishes a new one. */
function slugOf(value: unknown, except: StoredPage | null = null): string {
    if (typeof value !== 'string' || value.length > 120 || !SLUG.test(value)) {
        throw issue('slug', 'pattern', 'Use lowercase letters, numbers and dashes.');
    }
    if (store.pages.some((page) => page !== except && (page.slug === value || page.live?.slug === value))) {
        throw issue('slug', 'unique', 'Another page already uses this address.');
    }
    return value;
}

const pageOf = (id: string | undefined): StoredPage => found(store.pages.find((page) => String(page.id) === id));
const assetOf = (id: string | undefined): StoredAsset => found(store.assets.find((asset) => String(asset.id) === id));
const summary = (page: StoredPage): PageSummary => ({ id: page.id, slug: page.slug, title: page.title, publishedAt: page.live?.at ?? null });
const state = (page: StoredPage): PageState => ({
    ...summary(page),
    seo: page.seo,
    draft: page.draft,
    revision: page.revision,
    versions: page.versions.map(({ id, createdAt, by }) => ({ id, createdAt, by })),
});
const assetJson = ({ id, name }: StoredAsset): Asset => ({ id, ref: `media:${id}`, name, url: `/api/media/${id}`, thumb: `/api/media/${id}`, width: null, height: null });
const used = (): number => store.assets.reduce((sum, asset) => sum + asset.size, 0);
const workspace = (): Workspace => ({
    site: store.site,
    meta: store.meta,
    publicUrl: PUBLIC_URL,
    pages: [...store.pages].sort((a, b) => a.slug.localeCompare(b.slug)).map(summary),
    catalog,
    assets: [...store.assets].reverse().map(assetJson),
    quota: { used: used(), limit: QUOTA },
});

/** Visitors may fetch an image only once something published shows it. */
const isPublic = (asset: StoredAsset): boolean =>
    JSON.stringify([store.site.favicon, store.site.og_image, store.meta, ...store.pages.map((page) => page.live?.document)]).includes(`"media:${asset.id}"`);

/**
 * Raster types only, recognized by their first bytes rather than by the name
 * or what the browser claims. No SVG: it can carry script, and nothing here
 * sanitizes it.
 */
const SIGNATURES: [type: string, offset: number, magic: string][] = [
    ['image/png', 0, '\x89PNG\r\n\x1a\n'],
    ['image/jpeg', 0, '\xff\xd8\xff'],
    ['image/gif', 0, 'GIF8'],
    ['image/webp', 8, 'WEBP'],
    ['image/avif', 4, 'ftypavif'],
];
const sniff = (bytes: Uint8Array): string | null =>
    SIGNATURES.find(([, offset, magic]) => [...magic].every((char, index) => bytes[offset + index] === char.charCodeAt(0)))?.[0] ?? null;

type FormState = { status?: number; old?: Map<string, string>; errors?: Record<string, string>; notice?: string | null };

async function publicPage(live: Live, form: FormState = {}): Promise<Response> {
    const phone = typeof store.meta.phone === 'string' ? store.meta.phone.replace(/[^0-9+]/g, '') : '';
    const rendered = await renderPage({
        document: parseDocument(live.document, catalog),
        catalog,
        site: parseSiteSettings(store.site),
        page: { slug: live.slug, seo: live.seo, url: new URL(live.slug, PUBLIC_URL).href },
        base: '',
        mode: 'public',
        host: {
            media: (ref) => {
                const asset = store.assets.find((candidate) => `media:${candidate.id}` === ref);
                return asset && isPublic(asset) ? { url: new URL(`media/${asset.id}`, PUBLIC_URL).href, thumb: null, width: null, height: null } : null;
            },
            action: (action) => (action.type === 'call_us' && phone !== '' ? `tel:${phone}` : null),
            appElement: (element) => renderPosts(element.props),
            // No session, so no CSRF token: a public form has no signed-in state to protect.
            form: { action: '/submit', csrf: null, old: (key) => form.old?.get(key) ?? null, error: (key) => form.errors?.[key] ?? null, notice: form.notice ?? null },
        },
    });

    return html(rendered.html, form.status);
}

function fieldProblem(field: FormField, value: string): string | null {
    const label = field.label || 'This field';
    if (value.trim() === '') {
        return field.required ? `${label} is required.` : null;
    }
    if (value.length > 2000) {
        return `${label} is too long.`;
    }
    if (field.kind === 'input' && field.inputType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return `${label} must be an email address.`;
    }
    return field.kind === 'select' && !field.options.includes(value) ? `Choose one of the options for ${label}.` : null;
}

/** Answers by label (the field id when it has none), for reading in the editor. */
const answers = (fields: FormField[], value: (field: FormField) => string): Record<string, string> =>
    Object.fromEntries(fields.map((field) => [field.label || field.name, field.kind === 'checkbox' ? (value(field) ? 'yes' : 'no') : value(field)]));

type Handler = (request: Request, params: Record<string, string | undefined>, url: URL) => Response | Promise<Response>;
const routes: { method: string; pattern: URLPattern; handler: Handler }[] = [];
const on = (method: string, pathname: string, handler: Handler): void => void routes.push({ method, pattern: new URLPattern({ pathname }), handler });

on('GET', '/api{/}?', () => Response.json(workspace()));

on('PUT', '/api/site', async (request) => {
    const update = await jsonBody(request);
    const settings = Object.fromEntries(['seo', 'locale', 'favicon', 'og_image'].filter((key) => key in update).map((key) => [key, update[key]]));
    const theme = isRecord(update.theme) ? { ...store.site.theme, ...update.theme } : update.theme ?? store.site.theme;
    const site = parsed('', () => parseSiteSettings({ ...store.site, ...settings, theme }));
    const meta = update.meta === undefined ? {} : parsed('meta', () => parseFields(catalog.siteFields ?? [], update.meta));
    store.site = site;
    Object.assign(store.meta, Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined)));
    save();
    return Response.json(workspace());
});

on('GET', '/api/pages/:id', (_, { id }) => Response.json(state(pageOf(id))));

on('POST', '/api/pages', async (request) => {
    const body = await jsonBody(request);
    const title = titleOf(body.title);
    const slug = slugOf(body.slug);
    const draft = body.draft === undefined ? BLANK : draftOf(body.draft);
    const page: StoredPage = { id: store.nextId++, title, slug, seo: {}, draft, revision: 1, live: null, versions: [] };
    store.pages.push(page);
    save();
    return Response.json(state(page), { status: 201 });
});

on('PUT', '/api/pages/:id', async (request, { id }) => {
    const page = pageOf(id);
    const body = await jsonBody(request);
    if (typeof body.baseRevision !== 'number') {
        throw issue('baseRevision', 'required', 'Send the revision this change is based on.');
    }
    const title = body.title === undefined ? page.title : titleOf(body.title);
    const slug = body.slug === undefined ? page.slug : slugOf(body.slug, page);
    const seo = body.seo === undefined ? page.seo : parsed('seo', () => parseSeo(body.seo));
    const draft = body.draft === undefined ? page.draft : draftOf(body.draft);
    if (body.baseRevision !== page.revision) {
        return conflict(page);
    }
    Object.assign(page, { title, slug, seo, draft, revision: page.revision + 1 });
    save();
    return Response.json({ revision: page.revision });
});

on('DELETE', '/api/pages/:id', (_, { id }) => {
    const page = pageOf(id);
    store.pages = store.pages.filter((candidate) => candidate !== page);
    save();
    return Response.json(null);
});

/** Publishing what is already live changes nothing, and only a changed document is a new version, so a retry creates none. */
on('POST', '/api/pages/:id/publish', async (request, { id }) => {
    const page = pageOf(id);
    const { revision } = await jsonBody(request);
    if (typeof revision !== 'number') {
        throw issue('revision', 'required', 'Send the revision to publish.');
    }
    if (revision !== page.revision) {
        return conflict(page);
    }
    const { live } = page;
    if (live === null || JSON.stringify([live.slug, live.seo, live.document]) !== JSON.stringify([page.slug, page.seo, page.draft])) {
        const at = new Date().toISOString();
        if (JSON.stringify(live?.document) !== JSON.stringify(page.draft)) {
            page.versions = [{ id: store.nextId++, createdAt: at, by: null, document: page.draft }, ...page.versions].slice(0, 20);
        }
        page.live = { slug: page.slug, seo: page.seo, document: page.draft, at };
        save();
    }
    return Response.json(state(page));
});

on('POST', '/api/pages/:id/versions/:version/restore', (_, { id, version }) => {
    const page = pageOf(id);
    const restored = found(page.versions.find((candidate) => String(candidate.id) === version));
    Object.assign(page, { draft: restored.document, revision: page.revision + 1 });
    save();
    return Response.json(state(page));
});

on('POST', '/api/assets', async (request) => {
    const upload = (await request.formData().catch(() => null))?.get('file');
    if (!(upload instanceof File)) {
        throw issue('file', 'required', 'Choose a file.');
    }
    if (upload.size > UPLOAD_MAX) {
        throw issue('file', 'size', 'The image is larger than 5 MB.');
    }
    const bytes = new Uint8Array(await upload.arrayBuffer());
    const type = sniff(bytes);
    if (type === null) {
        throw issue('file', 'enum', 'Use a JPG, PNG, GIF, WebP or AVIF image.');
    }
    if (used() + bytes.length > QUOTA) {
        throw issue('file', 'size', 'The image library is full.');
    }
    const asset: StoredAsset = { id: store.nextId++, name: upload.name.slice(0, 120), type, size: bytes.length };
    writeFileSync(mediaPath(asset.id), bytes);
    store.assets.push(asset);
    save();
    return Response.json(assetJson(asset), { status: 201 });
});

on('DELETE', '/api/assets/:id', (_, { id }) => {
    const asset = assetOf(id);
    store.assets = store.assets.filter((candidate) => candidate !== asset);
    save();
    rmSync(mediaPath(asset.id), { force: true });
    return Response.json(null);
});

on('GET', '/api/media/:id', (_, { id }) => {
    const asset = assetOf(id);
    return file(mediaPath(asset.id), asset.type);
});

on('POST', '/api/preview', async (request) => {
    const { elements } = await jsonBody(request);
    if (!Array.isArray(elements)) {
        throw issue('elements', 'required', 'Send the elements to preview.');
    }
    const previews: Record<string, string> = {};
    for (const [index, element] of elements.entries()) {
        if (!isRecord(element) || typeof element.id !== 'string') {
            throw issue(`elements.${index}`, 'type', 'Each element needs an id, a type and props.');
        }
        const spec = catalog.elements.find((candidate) => candidate.type === element.type);
        if (spec) {
            previews[element.id] = renderPosts(parsed(`elements.${index}.props`, () => parseFields(spec.fields, element.props)));
        }
    }
    return Response.json(previews);
});

on('GET', '/api/submissions', (_, __, url) => {
    const cursor = Number(url.searchParams.get('cursor') ?? Infinity);
    const older = store.submissions.filter((submission) => submission.id < cursor).reverse();
    const data = older.slice(0, 20);
    return Response.json({ data, next: older.length > data.length ? String(data.at(-1)?.id) : null });
});

on('GET', '/admin', () => html('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>Lienzo editor</title><script type="module" src="/admin/lienzo-editor.js"></script></head>'
    + '<body style="margin:0"><lienzo-editor endpoint="/api" style="display:block;height:100vh"></lienzo-editor></body></html>'));
on('GET', '/admin/lienzo-editor.js', () => file(EDITOR_BUNDLE, 'text/javascript'));
on('GET', '/admin/lienzo-editor.js.map', () => file(`${EDITOR_BUNDLE}.map`, 'application/json'));

/** The app's own admin: a new post shows on the published page with no republish. */
on('POST', '/admin/posts', async (request) => {
    const { title } = await jsonBody(request);
    if (typeof title !== 'string' || title.trim() === '') {
        throw issue('title', 'required', 'Give the post a title.');
    }
    posts.unshift({ title: title.trim(), date: new Date().toISOString().slice(0, 10) });
    return Response.json(posts, { status: 201 });
});

on('GET', '/media/:id', (_, { id }) => {
    const asset = assetOf(id);
    if (!isPublic(asset)) {
        throw notFound();
    }
    return file(mediaPath(asset.id), asset.type);
});

on('GET', '/sitemap.xml', () => {
    const live = store.pages.flatMap((page) => (page.live ? [page.live] : [])).sort((a, b) => a.slug.localeCompare(b.slug));
    const urls = live.map((page) => `<url><loc>${escapeHtml(new URL(page.slug, PUBLIC_URL).href)}</loc><lastmod>${page.at.slice(0, 10)}</lastmod></url>`);
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
});

on('GET', '/robots.txt', () => {
    const sitemap = store.pages.some((page) => page.live) ? [`Sitemap: ${new URL('sitemap.xml', PUBLIC_URL).href}`] : [];
    return new Response(['User-agent: *', 'Disallow:', ...sitemap, ''].join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
});

/**
 * The browser's form post. Only the fields the form has on the published page
 * count, whatever arrives. A failed check renders the page again with the
 * values and messages; a stored one redirects back with `?sent`.
 */
on('POST', '/submit', async (request) => {
    const form = new URLSearchParams(await request.text());
    const slug = form.get('slug') ?? '';
    // Bots fill the hidden field; they get the same answer and nothing is stored.
    if (form.get('website')) {
        return redirect(`/${slug}?sent`);
    }
    const live = store.pages.find((page) => page.live?.slug === slug)?.live;
    const spec = live && formFields(parseDocument(live.document, catalog)).find((candidate) => candidate.source === form.get('source'));
    if (!live || !spec) {
        return html('<!doctype html><title>Form unavailable</title><p>This form is no longer available.</p>', 422);
    }
    const value = (field: FormField): string => form.get(`fields[${field.name}]`) ?? '';
    const errors = Object.fromEntries(spec.fields.flatMap((field) => {
        const problem = fieldProblem(field, value(field));
        return problem === null ? [] : [[`fields.${field.name}`, problem]];
    }));
    if (Object.keys(errors).length > 0) {
        const old = new Map([...form].map(([key, entry]) => [key.replace(/^fields\[(.+)\]$/, 'fields.$1'), entry]));
        return publicPage(live, { status: 422, old, errors });
    }
    store.submissions.push({ id: store.nextId++, page: slug, source: spec.source, fields: answers(spec.fields, value), createdAt: new Date().toISOString() });
    save();
    return redirect(`/${slug}?sent`);
});

on('GET', '/{:slug([a-z0-9\\-]+)}?', (_, { slug = '' }, url) => {
    const live = store.pages.find((page) => page.live?.slug === slug)?.live;
    if (!live) {
        return html('<!doctype html><title>Not found</title><p>This page is not published.</p>', 404);
    }
    return publicPage(live, { notice: url.searchParams.has('sent') ? 'Thanks, your message was sent.' : null });
});

async function handle(req: IncomingMessage): Promise<Response> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > MAX_BODY) {
            throw new Response('Too large.', { status: 413 });
        }
        chunks.push(chunk);
    }
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', PUBLIC_URL);
    const request = new Request(url, {
        method,
        headers: { 'Content-Type': req.headers['content-type'] ?? '' },
        ...(method === 'GET' || method === 'HEAD' ? {} : { body: Buffer.concat(chunks) }),
    });
    const route = routes.find((candidate) => candidate.method === method && candidate.pattern.test({ pathname: url.pathname }));
    if (!route) {
        return html('<!doctype html><title>Not found</title><p>Not found.</p>', 404);
    }
    return route.handler(request, route.pattern.exec({ pathname: url.pathname })?.pathname.groups ?? {}, url);
}

function failure(error: unknown): Response {
    if (error instanceof Response) {
        return error;
    }
    console.error(error);
    return new Response('Server error.', { status: 500 });
}

createServer(async (req, res) => {
    const response = await handle(req).catch(failure);
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`Lienzo example at ${PUBLIC_URL}, editor at ${new URL('admin', PUBLIC_URL).href}`));
