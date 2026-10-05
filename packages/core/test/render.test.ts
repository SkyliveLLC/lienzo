import { describe, expect, it } from 'vitest';
import { actionAttrs } from '../src/actions.ts';
import { escape, h, num } from '../src/html.ts';
import {
    emptyCatalog,
    formFields,
    parseDocument,
    parseSiteSettings,
    renderPage,
    trustedHtml,
    type Catalog,
    type FormHost,
    type RenderInput,
} from '../src/index.ts';
import { fixtureCatalog } from './fixtures.ts';

const element = (id: string, type: string, props: Record<string, unknown> = {}, style: Record<string, unknown> = {}, y = 0) => ({
    id,
    type,
    z: 1,
    layout: { desktop: { x: 0, y, w: 50, h: 40 }, mobile: null },
    props,
    style,
});

const section = (id: string, elements: unknown[], group?: Record<string, unknown>) => ({
    id,
    ...(group ? { group } : {}),
    height: { desktop: 400, mobile: 400 },
    background: { type: 'color', color: 'background' },
    elements,
});

const form: FormHost = {
    action: 'https://example.test/submit',
    csrf: { name: '_token', value: 'csrf' },
    old: (key) => ({ 'fields.name': 'Ana <b>', source: 'promo' })[key] ?? null,
    error: (key) => ({ 'fields.email': 'Required' })[key] ?? null,
};

function render(document: unknown, options: { catalog?: Catalog; mode?: RenderInput['mode']; form?: FormHost | null; locale?: string } = {}) {
    const catalog = options.catalog ?? emptyCatalog;

    return renderPage({
        document: parseDocument(document, catalog),
        catalog,
        site: parseSiteSettings({ name: 'Demo', locale: options.locale ?? 'en' }),
        page: { slug: 'home', seo: {}, url: 'https://example.test/home' },
        base: '/site',
        mode: options.mode ?? 'public',
        host: {
            media: (ref) => (ref === 'media:1' ? { url: 'https://example.test/m/1', thumb: null, width: 10, height: 10 } : null),
            action: (action) => (action.type === 'booking' ? '/book' : null),
            appElement: (app) => trustedHtml(`<b>${app.type}</b>`),
            form: options.form === undefined ? form : options.form,
        },
    });
}

describe('canonical output', () => {
    it.each([
        [26.666666666666668, '26.667'],
        [1.0005, '1.001'],
        [-1.0005, '-1.001'],
        [0.0005, '0.001'],
        [-0.0004, '0'],
        [1e-7, '0'],
        [2.5, '2.5'],
        [1234, '1234'],
        [9.9995, '10'],
    ])('formats %s as %s', (value, expected) => {
        expect(num(value)).toBe(expected);
    });

    it('escapes like htmlspecialchars with ENT_QUOTES', () => {
        expect(escape(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#039;Jerry&#039;&lt;/a&gt;');
    });

    it('sorts attributes and refuses unsafe URLs', () => {
        expect(h('a', { target: '_blank', href: 'https://x.test', class: 'b' })).toBe('<a class="b" href="https://x.test" target="_blank"></a>');
        expect(() => h('a', { href: 'javascript:alert(1)' })).toThrow();
        expect(() => h('img', { src: 'data:image/png;base64,x' })).toThrow();
    });
});

describe('actions', () => {
    const resolve = (type: string, value = '') => actionAttrs({ type, value }, '/site', (action) => (action.type === 'booking' ? '/book' : null));

    it.each([
        ['whatsapp', '+57 300 111', { href: 'https://wa.me/57300111', target: '_blank', rel: 'noopener noreferrer' }],
        ['phone', '+57 (300) 111', { href: 'tel:+57300111' }],
        ['page', '--Sobre Nosotros!', { href: '/site/sobrenosotros' }],
        ['anchor', 'con tacto', { href: '#contacto' }],
        ['url', 'http://insecure.test', null],
        ['modal', 'pro mo', { href: '#', 'data-modal': 'promo' }],
        ['modal', '', null],
        ['top', '', { href: '#', 'data-top': true }],
        ['step_prev', '', { href: '#', 'data-step': 'prev' }],
        ['booking', '', { href: '/book' }],
        ['unregistered', 'x', null],
    ])('%s %j', (type, value, expected) => {
        expect(resolve(type, value)).toEqual(expected);
    });
});

describe('renderPage', () => {
    it('escapes user text and emits no script but the runtime', async () => {
        const page = await render({ sections: [section('s', [element('t', 'text', { text: '<script>alert(1)</script>' })])] });

        expect(page.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(page.html.match(/<script/g)).toHaveLength(1);
    });

    it('keeps URLs out of the page CSS', async () => {
        const page = await render({
            sections: [{ ...section('s', [element('i', 'image', { src: 'media:1' })]), background: { type: 'image', image: 'https://example.test/bg.jpg' } }],
        });

        expect(page.css).not.toMatch(/url\(|https?:/);
        expect(page.body).toContain('<img alt="" class="lz-bg" decoding="async" src="https://example.test/bg.jpg">');
    });

    it('renders a steps group with fields as one form across its steps', async () => {
        const document = {
            sections: [
                section('one', [element('name', 'input', { label: 'Name', required: true })], { id: 'signup', type: 'steps', label: '' }),
                section('two', [element('email', 'input', { input_type: 'email' }), element('send', 'button', { label: 'Go', action: { type: 'submit' } })], { id: 'signup', type: 'steps' }),
            ],
        };
        const { body } = await render(document);

        expect(body.match(/<form/g)).toHaveLength(1);
        expect(body).toMatch(/^<form action="https:\/\/example\.test\/submit" class="lz-stack" data-group="steps" id="g-signup" method="post">/);
        expect(body).toContain('<input name="source" type="hidden" value="signup">');
        expect(body).toContain('name="fields[name]" required type="text" value="Ana &lt;b&gt;"');
        expect(body).toContain('<em class="lz-field-error">Required</em>');
        expect(body).toContain('<i>1</i>Step 1</button>');
        expect(formFields(parseDocument(document, emptyCatalog))).toEqual([{
            source: 'signup',
            fields: [
                { kind: 'input', name: 'name', label: 'Name', required: true, inputType: 'text' },
                { kind: 'input', name: 'email', label: '', required: false, inputType: 'email' },
            ],
        }]);
    });

    it('lists section and modal forms separately', () => {
        const document = parseDocument({
            sections: [section('contact', [element('msg', 'textarea')]), section('plain', [element('t', 'text')])],
            modals: [{ id: 'promo', title: 'Promo', width: 400, height: { desktop: 300, mobile: 300 }, background: { type: 'color' }, elements: [element('ok', 'checkbox', { label: 'OK' })] }],
        }, emptyCatalog);

        expect(formFields(document).map((spec) => [spec.source, spec.fields.map((field) => field.kind)])).toEqual([
            ['contact', ['textarea']],
            ['promo', ['checkbox']],
        ]);
    });

    it('reopens the modal a failed submission came from', async () => {
        const { body } = await render({
            sections: [section('s', [])],
            modals: [{ id: 'promo', title: 'Promo', width: 400, height: { desktop: 300, mobile: 300 }, background: { type: 'color' }, elements: [] }],
        });

        expect(body).toContain('data-open');
    });

    it('gives navbar links and icons the same behaviour as buttons', async () => {
        const { body } = await render({
            sections: [section('s', [
                element('nav', 'navbar', { links: [{ label: 'Promo', action: { type: 'modal', value: 'promo' } }, { label: 'Up', action: { type: 'top' } }] }),
                element('ic', 'icon', { icon: 'star', action: { type: 'step_next' } }),
            ])],
        });

        expect(body).toContain('<a data-modal="promo" href="#">Promo</a>');
        expect(body).toContain('<a data-top href="#">Up</a>');
        expect(body).toMatch(/<a aria-label="star" class="lz-el lz-icon" data-step="next" href="#" id="e-ic">/);
    });

    it('renders app elements through the host and scopes their CSS', async () => {
        const page = await render({ sections: [section('s', [element('svc', 'services', { limit: 2 })])] }, { catalog: fixtureCatalog });

        expect(page.body).toContain('<div class="lz-el" data-type="services" id="e-svc"><b>services</b></div>');
        expect(page.css).toContain('.lz-el[data-type="services"]{.cards{');
    });

    it('renders unregistered element types only as an editor placeholder', async () => {
        const document = { sections: [section('s', [element('map', 'map', { lat: 1 })])] };

        expect((await render(document)).body).not.toContain('e-map');
        expect((await render(document, { mode: 'edit' })).body).toContain('class="lz-el lz-placeholder" data-type="map"');
    });

    it('localizes page strings', async () => {
        const document = { sections: [section('s', [element('sel', 'select', { options: ['A'] })])] };

        expect((await render(document, { locale: 'es' })).body).toContain('<option value="">Elige una opción</option>');
        expect((await render(document, { locale: 'pt-BR' })).body).toContain('<option value="">Choose an option</option>');
    });

    it('renders forms inert without a form host', async () => {
        const { body } = await render({ sections: [section('s', [element('n', 'input')])] }, { form: null });

        expect(body).toContain('<form><label class="lz-el lz-field" id="e-n">');
        expect(body).not.toContain('method="post"');
    });
});
