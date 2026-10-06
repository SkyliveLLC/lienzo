import { describe, expect, it } from 'vitest';
import { DocumentError, emptyCatalog, parseDocument, parseFields, parseSeo, parseSiteSettings, parseTheme, type Field } from '../src/index.ts';
import { documentNames, fixtureCatalog, storedDocument } from './fixtures.ts';

const element = (overrides: Record<string, unknown> = {}) => ({
    id: 'e1',
    type: 'text',
    z: 1,
    layout: { desktop: { x: 0, y: 0, w: 50, h: 40 }, mobile: null },
    props: { text: 'Hello' },
    style: {},
    ...overrides,
});

const page = (...elements: unknown[]) => ({
    sections: [{ id: 's1', height: { desktop: 400, mobile: 400 }, background: { type: 'color', color: 'background' }, elements }],
});

const issuesOf = (input: unknown) => {
    try {
        parseDocument(input, fixtureCatalog);
    } catch (error) {
        if (error instanceof DocumentError) {
            return error.issues.map((issue) => `${issue.path}:${issue.code}`);
        }
        throw error;
    }

    return [];
};

describe('parseDocument', () => {
    it.each(documentNames)('accepts the stored %s fixture and is stable on a second parse', (name) => {
        const parsed = parseDocument(storedDocument(name).content, fixtureCatalog);

        expect(JSON.parse(JSON.stringify(parseDocument(parsed, fixtureCatalog)))).toEqual(JSON.parse(JSON.stringify(parsed)));
    });

    it('keeps every element, including types no catalog registers', () => {
        const stored = storedDocument('element-services').content as { sections: { elements: unknown[] }[] };
        const parsed = parseDocument(stored, emptyCatalog);

        expect(parsed.sections.map((section) => section.elements.length)).toEqual(stored.sections.map((section) => section.elements.length));
        expect(parsed.sections[0]?.elements.find((entry) => entry.type === 'services')?.props).toEqual(
            stored.sections[0]?.elements.map((entry) => entry as { type: string; props: unknown }).find((entry) => entry.type === 'services')?.props,
        );
    });

    it('strips keys the schema does not know, at every level', () => {
        const parsed = parseDocument({ ...page(element({ extra: 1, props: { text: 'Hi', onclick: 'x' }, style: { color: 'text', css: 'x' } })), junk: true }, emptyCatalog);

        expect(parsed).toEqual(page(element({ props: { text: 'Hi' }, style: { color: 'text' } })));
    });

    it('checks app element props against their declared fields', () => {
        const services = (props: Record<string, unknown>) => page(element({ type: 'services', props }));

        expect(parseDocument(services({ limit: 3, variant: 'list', stray: 1 }), fixtureCatalog).sections[0]?.elements[0]?.props).toEqual({ limit: 3, variant: 'list' });
        expect(issuesOf(services({ limit: 40 }))).toEqual(['sections.0.elements.0.props.limit:range']);
        expect(issuesOf(services({ variant: 'grid' }))).toEqual(['sections.0.elements.0.props.variant:enum']);
    });

    it('upgrades legacy text modals into a canvas with one text element', () => {
        const parsed = parseDocument({ ...page(), modals: [{ id: 'promo', title: 'Promo', text: '  Ten percent off  ' }] }, emptyCatalog);

        expect(parsed.modals?.[0]).toMatchObject({
            id: 'promo',
            size: 'custom',
            show_title: true,
            width: 520,
            elements: [{ id: 'promo-text', type: 'text', props: { text: 'Ten percent off' } }],
        });
    });

    it('accepts PHP empty arrays where objects are expected', () => {
        expect(parseDocument(page(element({ type: 'divider', props: [], style: [] })), emptyCatalog).sections[0]?.elements[0]).toMatchObject({ props: {}, style: {} });
    });

    it('accepts empty objects where lists are expected, since PHP encodes both as []', () => {
        const parsed = parseDocument({ ...page(element({ type: 'select', props: { options: {} } })), modals: {} }, emptyCatalog);

        expect(parsed.modals).toEqual([]);
        expect(parsed.sections[0]?.elements[0]?.props).toEqual({ options: [] });
    });

    it('tells a value of the wrong type from a missing one', () => {
        const { z: _, ...withoutZ } = element();

        expect(issuesOf(page(element({ z: 'top' })))).toEqual(['sections.0.elements.0.z:type']);
        expect(issuesOf(page(withoutZ))).toEqual(['sections.0.elements.0.z:required']);
        expect(issuesOf({ sections: [{ ...page().sections[0], background: {} }] })).toEqual(['sections.0.background.type:required']);
    });

    it('reports a wrong type once, without the size of the wrong value', () => {
        expect(issuesOf({ sections: '' })).toEqual(['sections:type']);
    });

    it('upgrades a legacy modal whose id is not a string without crashing', () => {
        expect(issuesOf({ ...page(), modals: [{ id: { toString: 0 }, text: 'Hi' }] })).toEqual(['modals.0.id:type']);
    });

    it('reads an app field named like an Object member as missing when it is', () => {
        const catalog = { elements: [{ ...fixtureCatalog.elements[0]!, type: 'proto', fields: [{ kind: 'toggle' as const, key: 'constructor', label: { en: 'C' }, default: false }] }], actions: [] };

        expect(parseDocument(page(element({ type: 'proto', props: {} })), catalog).sections[0]?.elements[0]?.props).toEqual({});
    });
});

describe('hostile documents', () => {
    it('renders script in text inert by keeping it as text', () => {
        const parsed = parseDocument(page(element({ props: { text: '<script>alert(1)</script>' } })), emptyCatalog);

        expect(parsed.sections[0]?.elements[0]?.props).toEqual({ text: '<script>alert(1)</script>' });
    });

    it.each([
        ['javascript: image', element({ type: 'image', props: { src: 'javascript:alert(1)' } }), 'props.src:pattern'],
        ['http image', element({ type: 'image', props: { src: 'http://example.com/a.png' } }), 'props.src:pattern'],
        ['quote in image url', element({ type: 'image', props: { src: 'https://a.test/x"onerror="y' } }), 'props.src:pattern'],
        ['javascript: video url', element({ type: 'video', props: { url: 'javascript:alert(1)' } }), 'props.url:pattern'],
        ['css in a color', element({ style: { color: 'red;}body{display:none' } }), 'style.color:pattern'],
        ['named color', element({ style: { background: 'red' } }), 'style.background:pattern'],
        ['css in a gradient color', element({ style: { gradient: { type: 'linear', from: '#000000);x:(', to: 'text' } } }), 'style.gradient.from:pattern'],
        ['unknown icon', element({ type: 'icon', props: { icon: '"><script>' } }), 'props.icon:enum'],
        ['too many options', element({ type: 'select', props: { options: Array.from({ length: 31 }, (_, index) => `o${index}`) } }), 'props.options:size'],
        ['too many links', element({ type: 'navbar', props: { links: Array.from({ length: 9 }, () => ({ label: 'a', action: { type: 'top' } })) } }), 'props.links:size'],
        ['oversized opaque props', element({ type: 'map', props: { blob: 'x'.repeat(20000) } }), 'props:size'],
        ['opaque props over the limit in UTF-8 bytes', element({ type: 'map', props: { blob: 'é'.repeat(9000) } }), 'props:size'],
        ['element type with markup', element({ type: 'x"><b>' }), 'type:pattern'],
    ])('rejects %s', (_, hostile, issue) => {
        expect(issuesOf(page(hostile))).toEqual([`sections.0.elements.0.${issue}`]);
    });

    it('rejects oversized canvases', () => {
        expect(issuesOf(page(...Array.from({ length: 61 }, (_, index) => element({ id: `e${index}` }))))).toEqual(['sections.0.elements:size']);
        expect(issuesOf({ sections: Array.from({ length: 41 }, () => page().sections[0]) })).toEqual(['sections:size']);
    });
});

describe('parseTheme', () => {
    it('fills missing keys with the defaults', () => {
        expect(parseTheme({ primary: '#111111' })).toMatchObject({ primary: '#111111', heading_font: 'Inter', max_width: 1200 });
    });

    it.each([
        ['font injection', { heading_font: "Inter';}body{x:y" }],
        ['font url injection', { body_font: 'Inter&family=Evil' }],
        ['token instead of hex', { primary: 'primary' }],
        ['radius out of range', { radius: 41 }],
        ['width out of range', { max_width: 800 }],
    ])('rejects %s', (_, theme) => {
        expect(() => parseTheme(theme)).toThrow(DocumentError);
    });

    it('defaults the site locale to English', () => {
        expect(parseSiteSettings({ name: 'Demo' })).toMatchObject({ name: 'Demo', locale: 'en', seo: {}, favicon: null });
    });
});

describe('parseFields', () => {
    const fields: Field[] = [
        { kind: 'text', key: 'phone', label: { en: 'Phone' }, max: 20 },
        { kind: 'toggle', key: 'chat', label: { en: 'Chat' }, default: false },
    ];
    const issues = (input: unknown) => {
        try {
            parseFields(fields, input);
        } catch (error) {
            if (error instanceof DocumentError) {
                return error.issues.map((issue) => `${issue.path}:${issue.code}`);
            }
            throw error;
        }

        return [];
    };

    it('keeps the declared values and drops keys no field declares', () => {
        expect(parseFields(fields, { phone: '+1 555 0100', chat: true, admin: true })).toEqual({ phone: '+1 555 0100', chat: true });
    });

    it('keeps every value a choice field that takes several was given, and refuses one that is not an option', () => {
        const several: Field[] = [
            { kind: 'choice', key: 'services', label: { en: 'Services' }, options: [{ value: 'a', label: { en: 'A' } }, { value: 'b', label: { en: 'B' } }], default: [], multiple: true },
        ];

        expect(parseFields(several, { services: ['a', 'b'] })).toEqual({ services: ['a', 'b'] });
        expect(() => parseFields(several, { services: ['a', 'c'] })).toThrow(DocumentError);
        expect(() => parseFields(several, { services: 'a' })).toThrow(DocumentError);
    });

    it('reports each value that breaks its field, by key', () => {
        expect(issues({ phone: 'x'.repeat(21), chat: 'yes' })).toEqual(['phone:size', 'chat:type']);
        expect(issues('phone')).toEqual([':type']);
    });
});

describe('parseSeo', () => {
    it('accepts page tags and rejects oversized ones', () => {
        expect(parseSeo({ title: 'Home', description: null })).toEqual({ title: 'Home', description: null });
        expect(() => parseSeo({ description: 'x'.repeat(301) })).toThrow(DocumentError);
    });
});
