import type { AppElement, Catalog, CoreElement, CoreElementType, Element, ElementSpec, FieldValue, StyleGroup } from '@skylive/lienzo-core';
import type { MessageKey } from '../i18n/index.ts';
import { isCoreType, newId } from './document.ts';
import { snap } from './geometry.ts';

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

type Draft = { box: { x: number; w: number; h: number }; props: CoreElement['props']; style: CoreElement['style'] };

type CoreSpec = {
    label: MessageKey;
    /** Form fields sit in their own palette group. */
    group: 'content' | 'form';
    /** Style panels the element shows. */
    styles: readonly StyleGroup[];
    /** The prop a double-click edits right on the canvas. */
    inline: 'text' | 'label' | null;
    /** A fresh element with a sensible look and copy in the editor's language. */
    create(t: Translate): Draft;
};

const ALL: readonly StyleGroup[] = ['fill', 'text', 'border', 'effects', 'motion'];
const NO_TEXT: readonly StyleGroup[] = ['fill', 'border', 'effects', 'motion'];

const field = (type: 'input' | 'textarea' | 'select' | 'checkbox') => (t: Translate): Draft => ({
    box: { x: 10, w: 40, h: type === 'textarea' ? 120 : type === 'checkbox' ? 32 : 76 },
    props: {
        label: type === 'checkbox' ? t('default.checkbox') : t('default.field'),
        placeholder: type === 'select' ? '' : t('default.fieldPlaceholder'),
        required: type !== 'select',
        input_type: 'text',
        options: type === 'select' ? [t('default.option', { n: 1 }), t('default.option', { n: 2 })] : [],
    },
    style: { color: 'text', background: 'surface', border_color: 'muted', border_width: 1, font: 'body', size: 15, align: 'left', radius: 10, padding: 10 },
});

/** Everything the editor knows per core type. A new core type does not compile until it is listed here. */
export const coreSpecs = {
    heading: {
        label: 'type.heading', group: 'content', styles: ALL, inline: 'text',
        create: (t) => ({
            box: { x: 10, w: 40, h: 80 },
            props: { text: t('default.heading'), level: 1 },
            style: { color: 'text', font: 'heading', size: 44, weight: 700, align: 'left', line_height: 1.1 },
        }),
    },
    text: {
        label: 'type.text', group: 'content', styles: ALL, inline: 'text',
        create: (t) => ({
            box: { x: 10, w: 40, h: 96 },
            props: { text: t('default.text') },
            style: { color: 'muted', font: 'body', size: 18, weight: 400, align: 'left', line_height: 1.6 },
        }),
    },
    image: {
        label: 'type.image', group: 'content', styles: NO_TEXT, inline: null,
        create: () => ({ box: { x: 55, w: 35, h: 260 }, props: { src: '', alt: '' }, style: { radius: 16, object_fit: 'cover' } }),
    },
    button: {
        label: 'type.button', group: 'content', styles: ALL, inline: 'label',
        create: (t) => ({
            box: { x: 10, w: 18, h: 52 },
            props: { label: t('default.button'), action: { type: 'url', value: '' } },
            style: { background: 'primary', color: 'background', font: 'body', size: 16, weight: 600, align: 'center', radius: 12 },
        }),
    },
    divider: {
        label: 'type.divider', group: 'content', styles: NO_TEXT, inline: null,
        create: () => ({ box: { x: 10, w: 80, h: 2 }, props: {}, style: { color: 'muted' } }),
    },
    video: {
        label: 'type.video', group: 'content', styles: ALL, inline: null,
        create: (t) => ({ box: { x: 30, w: 40, h: 260 }, props: { url: '', alt: t('default.video') }, style: { radius: 16 } }),
    },
    shape: {
        label: 'type.shape', group: 'content', styles: ALL, inline: null,
        create: () => ({ box: { x: 10, w: 20, h: 160 }, props: { shape: 'rectangle' }, style: { background: 'primary', radius: 16, opacity: 1 } }),
    },
    icon: {
        label: 'type.icon', group: 'content', styles: ALL, inline: null,
        create: () => ({ box: { x: 10, w: 5, h: 56 }, props: { icon: 'heart', stroke: 2 }, style: { color: 'primary' } }),
    },
    navbar: {
        label: 'type.navbar', group: 'content', styles: ALL, inline: null,
        create: (t) => ({ box: { x: 0, w: 100, h: 72 }, ...navbarPresets(t)[0]! }),
    },
    input: { label: 'type.input', group: 'form', styles: ALL, inline: null, create: field('input') },
    textarea: { label: 'type.textarea', group: 'form', styles: ALL, inline: null, create: field('textarea') },
    select: { label: 'type.select', group: 'form', styles: ALL, inline: null, create: field('select') },
    checkbox: { label: 'type.checkbox', group: 'form', styles: ALL, inline: null, create: field('checkbox') },
} satisfies Record<CoreElementType, CoreSpec>;

/** Ready-made menus: a starting point, then edited link by link like any element. */
export function navbarPresets(t: Translate): { name: MessageKey; props: CoreElement['props']; style: CoreElement['style'] }[] {
    const anchor = (label: MessageKey) => ({ label: t(label), action: { type: 'anchor', value: '' } });

    return [
        {
            name: 'navbar.preset.split',
            props: { brand: t('default.brand'), layout: 'split', links: [anchor('default.link.features'), anchor('default.link.about'), anchor('default.link.contact')] },
            style: { background: 'background', color: 'text', font: 'body', size: 16, weight: 600, padding: 20 },
        },
        {
            name: 'navbar.preset.center',
            props: { brand: '', layout: 'center', links: [anchor('default.link.home'), anchor('default.link.features'), anchor('default.link.about'), anchor('default.link.contact')] },
            style: { background: 'surface', color: 'text', font: 'body', size: 16, weight: 500, padding: 18 },
        },
        {
            name: 'navbar.preset.dark',
            props: { brand: t('default.brand'), layout: 'split', links: [anchor('default.link.features'), { label: t('default.link.start'), action: { type: 'anchor', value: '' } }] },
            style: { background: 'secondary', color: 'background', font: 'heading', size: 16, weight: 600, padding: 20 },
        },
    ];
}

/** What an element is to the editor: built in, declared by the app, or from a plugin that is gone. */
export type ElementKind =
    | { kind: 'core'; element: CoreElement; spec: CoreSpec }
    | { kind: 'app'; element: AppElement; spec: ElementSpec }
    | { kind: 'opaque'; element: Element };

export function kindOf(element: Element, catalog: Catalog): ElementKind {
    if (isCoreType(element.type)) {
        return { kind: 'core', element: element as CoreElement, spec: coreSpecs[element.type] };
    }

    const spec = catalog.elements.find((candidate) => candidate.type === element.type);

    return spec ? { kind: 'app', element: element as AppElement, spec } : { kind: 'opaque', element };
}

/** An element type the palette can add. */
export type Insertable = { kind: 'core'; type: CoreElementType } | { kind: 'app'; spec: ElementSpec };

/** A new element placed at `top` design pixels, sized and styled by its type. */
export function createElement(insertable: Insertable, top: number, t: Translate): Element {
    const draft = insertable.kind === 'core' ? coreSpecs[insertable.type].create(t) : appDraft(insertable.spec);
    const type = insertable.kind === 'core' ? insertable.type : insertable.spec.type;

    return {
        id: newId(type),
        type,
        z: 1,
        layout: { desktop: { ...draft.box, y: snap(top) }, mobile: null },
        props: draft.props,
        style: draft.style,
    };
}

function appDraft(spec: ElementSpec): { box: Draft['box']; props: Record<string, FieldValue>; style: CoreElement['style'] } {
    const props: Record<string, FieldValue> = {};

    for (const field of spec.fields) {
        if (field.kind !== 'image' && field.kind !== 'action' && field.default !== undefined) {
            props[field.key] = field.default;
        }
    }

    return { box: { x: 10, w: spec.size.w, h: spec.size.h }, props, style: {} };
}

/** A short name for layers: the element's own text when it has some, else its type. */
export function elementName(element: Element, label: string): string {
    const props: Record<string, unknown> = element.props;
    const text = [props.text, props.label, props.brand].find((value): value is string => typeof value === 'string' && value.trim() !== '');

    return text ? text.trim().slice(0, 28) : label;
}
