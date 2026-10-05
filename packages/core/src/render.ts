import { actionAttrs } from './actions.ts';
import { groupSections, isForm, isStepsForm, safeId, stackOrder, stacks, type Group } from './canvas.ts';
import type { Catalog } from './catalog.ts';
import { isCoreElement, type Action, type AppElement, type Element, type Modal, type Parsed, type Section, type Seo, type SiteSettings, type Document } from './document.ts';
import type { ElementContext, MediaFile } from './elements/context.ts';
import { coreElements } from './elements/index.ts';
import { escape, fragment, h, num, text, trustedHtml, type Attrs, type Child, type TrustedHtml } from './html.ts';
import { messagesFor, type Messages } from './messages.ts';
import { runtimeScript } from './runtime.generated.ts';
import { cssColor, projectStyle, type Vars } from './style.ts';
import { stylesheet } from './stylesheet.ts';

export type { MediaFile };

/** Everything the renderer cannot know by itself. One member per hole. */
export interface RenderHost {
    /** Resolves `media:<id>`. Null for a deleted or unknown asset. */
    media(ref: string): MediaFile | null;
    /** Href for an app-registered action type. Core actions never reach this. */
    action(action: Action & { type: string }): string | null;
    /** Live data lives here: called on every public render. */
    appElement(element: AppElement): TrustedHtml | Promise<TrustedHtml>;
    /** Null renders forms inert (the editor canvas). */
    form: FormHost | null;
    /** Developer-produced head markup (analytics, structured data). */
    head?: TrustedHtml;
    /** CSP nonce for the inline style and script. */
    nonce?: string;
}

export type FormHost = {
    /** Where every form on the page posts. */
    action: string;
    csrf: { name: string; value: string } | null;
    /** Previously submitted value, by `fields.<id>` (also `source`). */
    old(key: string): string | null;
    /** Validation message, by `fields.<id>`. */
    error(key: string): string | null;
    /** Confirmation shown after a successful submission. */
    notice?: string | null;
};

export type PageInfo = { slug: string; seo: Seo; /** Absolute canonical URL. */ url: string };

export type RenderInput = {
    document: Parsed<Document>;
    catalog: Catalog;
    site: Parsed<SiteSettings>;
    page: PageInfo;
    /** Path prefix for `page` actions, '' when pages live at the root. */
    base: string;
    /** `edit` drops entrance animations and the runtime, and shows a placeholder for unregistered element types. */
    mode: 'public' | 'edit';
    host: RenderHost;
};

export type Meta = { name?: string; property?: string; content: string };
export type Link = { rel: string; href: string; crossorigin?: true };

export type RenderedPage = {
    lang: string;
    title: string;
    meta: Meta[];
    links: Link[];
    /** Theme variables, one `#id{--var:..}` block per section, modal and element, and app element CSS. Never a URL. */
    css: string;
    /** Page content. A host that owns its layout puts it inside an element with class `lz-page`, next to `lienzo.css` and `runtime.js`. */
    body: TrustedHtml;
    head: TrustedHtml | null;
    /** The complete document, with `lienzo.css` and `runtime.js` inlined. */
    html: string;
};

/** Custom property values allowed in a vars block: a number, a hex color or a theme token. */
const VAR_VALUE = /^(-?\d+(\.\d+)?|#[0-9a-fA-F]{6}|var\(--(primary|secondary|background|surface|text|muted)\))$/;

type State = {
    input: RenderInput;
    t: Messages;
    rules: string[];
    appTypes: Set<string>;
};

/**
 * Walks groups, sections and modals, then elements. Core elements render
 * through their element function, app elements through `host.appElement`.
 * Every element root gets id `e-<id>`, class `lz-el`, its style projection
 * and a vars block. Pure apart from the host calls.
 */
export async function renderPage(input: RenderInput): Promise<RenderedPage> {
    const { document, site, page, host } = input;
    const state: State = { input, t: messagesFor(site.locale), rules: [], appTypes: new Set() };

    const groups = await inOrder(groupSections(document.sections), (group) => renderGroup(group, state));
    const modals = await inOrder(document.modals ?? [], (modal) => renderModal(modal, state));
    const notice = host.form?.notice;
    const body = fragment([
        notice ? h('p', { class: 'lz-notice', role: 'status' }, [text(notice)]) : null,
        ...groups,
        ...modals,
    ]);

    const css = [pageRule(input), ...state.rules, ...appCss(input.catalog, state.appTypes)].join('\n') + '\n';
    const title = filled(page.seo.title) ?? filled(site.seo.title) ?? site.name;
    const description = filled(page.seo.description) ?? filled(site.seo.description);
    const share = resolveMedia(site.og_image, host)?.url ?? null;
    const favicon = resolveMedia(site.favicon, host)?.url ?? null;
    const fonts = [...new Set([site.theme.heading_font, site.theme.body_font])]
        .map((font) => `family=${font.replaceAll(' ', '+')}:wght@300;400;500;600;700;800`)
        .join('&');

    const meta: Meta[] = [
        ...(description ? [{ name: 'description', content: description }] : []),
        { property: 'og:title', content: title },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: page.url },
        { property: 'og:site_name', content: site.name },
        ...(description ? [{ property: 'og:description', content: description }] : []),
        ...(share ? [{ property: 'og:image', content: share }, { name: 'twitter:card', content: 'summary_large_image' }, { name: 'twitter:image', content: share }] : []),
    ];
    const links: Link[] = [
        ...(favicon ? [{ rel: 'icon', href: favicon }, { rel: 'apple-touch-icon', href: favicon }] : []),
        { rel: 'canonical', href: page.url },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
        { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?${fonts}&display=swap` },
    ];

    const nonce = host.nonce ? ` nonce="${escape(host.nonce)}"` : '';
    const html = '<!DOCTYPE html>'
        + `<html lang="${escape(site.locale)}"><head>`
        + h('meta', { charset: 'utf-8' })
        + h('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' })
        + `<title>${escape(title)}</title>`
        + meta.map((entry) => h('meta', entry)).join('')
        + links.map((entry) => h('link', entry)).join('')
        + `<style${nonce}>\n${stylesheet}${css}</style>`
        + (host.head ?? '')
        + `</head><body class="lz-page">${body}`
        + (input.mode === 'public' ? `<script${nonce}>\n${runtimeScript}</script>` : '')
        + '</body></html>\n';

    return { lang: site.locale, title, meta, links, css, body, head: host.head ?? null, html };
}

/** One at a time, so the vars rules come out in document order whatever the host's timing. */
async function inOrder<T, R>(items: readonly T[], render: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = [];

    for (const [index, item] of items.entries()) {
        results.push(await render(item, index));
    }

    return results;
}

const filled = (value: string | null | undefined): string | null => (value && value.trim() !== '' ? value : null);

function resolveMedia(src: string | null | undefined, host: RenderHost): MediaFile | null {
    if (!src) {
        return null;
    }

    return src.startsWith('media:') ? host.media(src) : { url: src, thumb: null, width: null, height: null };
}

function pageRule({ document, site }: RenderInput): string {
    const { theme } = site;
    const sticky = Math.max(0, ...document.sections.flatMap((section) => section.elements)
        .filter((element) => isCoreElement(element) && element.type === 'navbar' && element.props.sticky)
        .map((element) => Math.trunc(element.layout.desktop.h) + 24));

    return `.lz-page{--primary:${theme.primary};--secondary:${theme.secondary};--background:${theme.background};`
        + `--surface:${theme.surface};--text:${theme.text};--muted:${theme.muted};--radius:${theme.radius}px;`
        + `--max-width:${theme.max_width}px;--ref:${theme.max_width};`
        + `--font-heading:'${theme.heading_font}', system-ui, sans-serif;--font-body:'${theme.body_font}', system-ui, sans-serif`
        + (sticky > 0 ? `;--sticky:${sticky}` : '')
        + '}';
}

/** App CSS is trusted developer code, nested under its type so its selectors match inside that element. */
function appCss(catalog: Catalog, used: ReadonlySet<string>): string[] {
    return catalog.elements
        .filter((spec) => used.has(spec.type) && spec.css)
        .map((spec) => {
            if (/<\/style/i.test(spec.css ?? '')) {
                throw new Error(`Refusing CSS for app element ${spec.type}: it closes the style tag`);
            }

            return `.lz-el[data-type="${spec.type}"]{${spec.css}}`;
        });
}

function rule(selector: string, vars: Vars): string {
    for (const [name, value] of vars) {
        if (!VAR_VALUE.test(value)) {
            throw new Error(`Refusing --${name}:${value}`);
        }
    }

    return `${selector}{${vars.map(([name, value]) => `--${name}:${value}`).join(';')}}`;
}

async function renderGroup(group: Group, state: State): Promise<TrustedHtml> {
    if (group.kind === 'single') {
        return renderSection(group.section, state, isForm(group.section) ? 'form' : null);
    }

    const stepsForm = isStepsForm(group);
    const panels = await inOrder(group.sections, async (section, index) => h('div', {
        class: 'lz-stack-panel',
        'data-panel': index,
        'data-on': index === 0,
    }, [await renderSection(section, state, isForm(section) ? (stepsForm ? 'div' : 'form') : null)]));
    const fallback = group.type === 'steps' ? state.t.step : state.t.tab;
    const nav = h('nav', { class: 'lz-stack-nav', 'aria-label': state.t.sections }, group.sections.map((section, index) => h('button', {
        type: 'button',
        'data-go': index,
        'aria-pressed': index === 0 ? 'true' : 'false',
    }, [
        group.type === 'steps' ? h('i', {}, [text(String(index + 1))]) : null,
        text(filled(section.group?.label) ?? fallback.replace('{n}', String(index + 1))),
    ])));
    const attrs = { class: 'lz-stack', id: `g-${safeId(group.id)}`, 'data-group': group.type };

    return stepsForm
        ? form(attrs, group.id, state, [nav, h('div', { class: 'lz-stack-panels' }, panels)])
        : h('div', attrs, [nav, h('div', { class: 'lz-stack-panels' }, panels)]);
}

/**
 * A form canvas wraps its elements in a block inside the frame, which is also
 * what decides their stacked order on mobile. Inside a steps form that block
 * is a plain `div`, so a step looks the same as a standalone form section.
 */
async function renderSection(section: Section, state: State, wrap: 'form' | 'div' | null): Promise<TrustedHtml> {
    const id = safeId(section.id);
    const { background } = section;
    const image = background.type === 'image' ? resolveMedia(background.image, state.input.host) : null;
    const gradient = background.type === 'gradient' && background.gradient?.from && background.gradient.to ? background.gradient : null;
    const vars: Vars = [['fh', num(section.height.desktop)], ['fmh', num(section.height.mobile)]];

    if (gradient) {
        vars.push(['sg1', cssColor(gradient.from ?? '')], ['sg2', cssColor(gradient.to ?? '')]);
        if (gradient.angle !== null && gradient.angle !== undefined) {
            vars.push(['sga', num(gradient.angle)]);
        }
    // An image background keeps its old color only as editor state; a deleted image leaves the section bare.
    } else if (!(background.type === 'image' && background.image) && background.color) {
        vars.push(['sbg', cssColor(background.color)]);
    }

    const parallax = background.parallax === true;
    const overlay = background.overlay ?? 0;
    if (overlay > 0) {
        vars.push(['ov', num(overlay)]);
    }

    state.rules.push(rule(`#s-${id}`, vars));

    const elements = await renderCanvas(section, state);
    // Stacked on mobile, a form's elements flow inline in its block, where the space between them shows.
    const spaced = elements.flatMap((element, index) => (index === 0 ? [element] : [text(' '), element]));

    return h('section', {
        id: `s-${id}`,
        class: 'lz-section',
        'data-fill': gradient ? gradient.type ?? 'linear' : null,
    }, [
        image && (parallax
            ? h('div', { class: 'lz-parallax' }, [h('img', { class: 'lz-bg', src: image.url, alt: '', decoding: 'async' })])
            : h('img', { class: 'lz-bg', src: image.url, alt: '', decoding: 'async' })),
        overlay > 0 && h('div', { class: 'lz-overlay' }),
        h('div', { class: 'lz-frame', 'data-stack': stacks(section) }, [
            wrap === 'form' ? form({}, section.id, state, spaced) : wrap === 'div' ? h('div', {}, spaced) : fragment(elements),
        ]),
    ]);
}

async function renderModal(modal: Modal, state: State): Promise<TrustedHtml> {
    const id = safeId(modal.id);
    const { form: formHost } = state.input.host;

    state.rules.push(rule(`#m-${id}`, [
        ['dw', num(modal.width)],
        ['dbg', cssColor(modal.background.color ?? 'background')],
        ['fh', num(modal.height.desktop)],
        ['fmh', num(modal.height.mobile)],
    ]));

    const frame = h('div', { class: 'lz-frame', 'data-stack': stacks(modal) }, await renderCanvas(modal, state));

    return h('dialog', {
        id: `m-${id}`,
        class: 'lz-modal',
        'aria-label': modal.title,
        'data-size': modal.size,
        'data-open': formHost !== null && formHost.old('source') === modal.id,
    }, [
        h('div', { class: 'lz-modal-bar' }, [
            modal.show_title ? h('h2', { class: 'lz-modal-title' }, [text(modal.title)]) : null,
            h('button', { type: 'button', class: 'lz-modal-close', 'data-close': true, 'aria-label': state.t.close }, [text('×')]),
        ]),
        isForm(modal) ? form({}, modal.id, state, [frame]) : frame,
    ]);
}

/** A live form posts `source` so the server can look up the fields of the published canvas. */
function form(attrs: Attrs, source: string, state: State, children: readonly Child[]): TrustedHtml {
    const { host, page } = state.input;

    if (host.form === null) {
        return h('form', attrs, children);
    }

    return h('form', { ...attrs, method: 'post', action: host.form.action }, [
        host.form.csrf && h('input', { type: 'hidden', name: host.form.csrf.name, value: host.form.csrf.value }),
        h('input', { type: 'hidden', name: 'slug', value: page.slug }),
        h('input', { type: 'hidden', name: 'source', value: source }),
        h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', hidden: true }),
        ...children,
    ]);
}

async function renderCanvas(canvas: Section | Modal, state: State): Promise<TrustedHtml[]> {
    const stacked = stacks(canvas);
    const order = stacked ? stackOrder(canvas.elements) : null;
    const live = isForm(canvas) && state.input.host.form !== null ? state.input.host.form : null;
    const context = elementContext(state, live);

    return inOrder(canvas.elements, (element) => renderElement(element, order?.get(element) ?? null, context, state));
}

function elementContext(state: State, form: FormHost | null): ElementContext {
    const { input } = state;
    const appActions = new Set(input.catalog.actions.map((spec) => spec.type));

    return {
        t: state.t,
        media: (src) => resolveMedia(src, input.host),
        action: (action) => actionAttrs(action, input.base, (app) => (appActions.has(app.type) ? input.host.action(app) : null)),
        form,
    };
}

/** Parse checked the props of every element whose type is in the catalog. */
const isAppElement = (element: Element, catalog: Catalog): element is AppElement =>
    !isCoreElement(element) && catalog.elements.some((spec) => spec.type === element.type);

async function renderElement(element: Element, order: number | null, context: ElementContext, state: State): Promise<TrustedHtml> {
    const { input } = state;
    const node = isCoreElement(element)
        ? coreElements[element.type](element, context)
        : isAppElement(element, input.catalog)
            ? { tag: 'div' as const, attrs: { 'data-type': element.type }, children: [await input.host.appElement(element)] }
            : input.mode === 'edit'
                ? { tag: 'div' as const, class: 'lz-placeholder', attrs: { 'data-type': element.type }, children: [text(state.t.unavailable)] }
                : null;

    if (node === null) {
        return trustedHtml('');
    }

    if (!isCoreElement(element)) {
        state.appTypes.add(element.type);
    }

    const id = safeId(element.id);
    const { desktop, mobile } = element.layout;
    const { vars, attrs } = projectStyle(element.style);
    const layout: Vars = [['x', num(desktop.x)], ['y', num(desktop.y)], ['w', num(desktop.w)], ['h', num(desktop.h)]];

    if (order !== null) {
        layout.push(['ord', num(order)]);
    } else if (mobile) {
        layout.push(['mx', num(mobile.x)], ['my', num(mobile.y)], ['mw', num(mobile.w)], ['mh', num(mobile.h)]);
    }

    layout.push(['z', num(element.z)]);
    state.rules.push(rule(`#e-${id}`, [...layout, ...vars]));

    if (input.mode === 'edit') {
        delete attrs['data-anim'];
    }

    return h(node.tag, {
        ...node.attrs,
        ...attrs,
        id: `e-${id}`,
        class: node.class ? `lz-el ${node.class}` : 'lz-el',
    }, node.children);
}
