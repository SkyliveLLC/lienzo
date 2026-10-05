import * as z from 'zod';
import type { Catalog, Field } from './catalog.ts';
import icons from './icons.json' with { type: 'json' };

export const THEME_TOKENS = ['primary', 'secondary', 'background', 'surface', 'text', 'muted'] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];

export const CORE_ELEMENT_TYPES = [
    'heading', 'text', 'image', 'button', 'divider', 'video', 'shape', 'icon',
    'navbar', 'input', 'textarea', 'select', 'checkbox',
] as const;
export type CoreElementType = (typeof CORE_ELEMENT_TYPES)[number];

export const FIELD_TYPES = ['input', 'textarea', 'select', 'checkbox'] as const satisfies readonly CoreElementType[];

export const CORE_ACTION_TYPES = [
    'none', 'whatsapp', 'phone', 'email', 'url', 'anchor', 'modal', 'submit', 'page', 'top', 'back', 'step_next', 'step_prev',
] as const;
export type CoreActionType = (typeof CORE_ACTION_TYPES)[number];

export const ICON_NAMES = Object.keys(icons) as [string, ...string[]];

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = z.string().regex(HEX);
/** A theme token stays a token so the page follows palette changes. */
const color = z.union([z.enum(THEME_TOKENS), hex]);
/** `media:<id>` is resolved by the host at render time; anything else must be a plain https URL. */
export const image = z.string().max(500).regex(/^(https:\/\/[^\s"'<>]+|media:[0-9]+)$/);
const httpsUrl = z.string().max(500).regex(/^https:\/\/[^\s"'<>]+$/);
const id = z.string().min(1).max(40);
const between = (min: number, max: number) => z.number().min(min).max(max);
const intBetween = (min: number, max: number) => z.int().min(min).max(max);

/**
 * PHP cannot tell an empty list from an empty map: both are `[]`. Stored
 * documents come from PHP, so an empty array where an object is expected is
 * an empty object, and the other way round, in every language.
 */
const emptyArrayAsObject = (value: unknown) => (Array.isArray(value) && value.length === 0 ? {} : value);
const emptyObjectAsArray = (value: unknown) => (isRecord(value) && Object.keys(value).length === 0 ? [] : value);
const object = <T extends z.ZodRawShape>(shape: T) => z.preprocess(emptyArrayAsObject, z.object(shape));
const list = <T extends z.ZodArray>(schema: T) => z.preprocess(emptyObjectAsArray, schema);

/** Every schema built by `optional`, so the JSON Schema export can mark it `x-blank-as-null`. */
export const blankAsNull = new WeakSet<object>();

/**
 * An optional typed value. Laravel skips every rule of a nullable field when
 * the value is blank, so a blank string means "not set" and becomes null.
 */
const optional = <T extends z.ZodType>(schema: T) => {
    const optionalSchema = z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? null : value), schema.nullish());
    blankAsNull.add(optionalSchema);

    return optionalSchema;
};

/** Core actions plus whatever the app registers. Unknown types survive and render inert, like opaque elements. */
const actionType = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
export const action = object({ type: optional(actionType), value: z.string().max(300).nullish() });

const gradient = object({
    type: optional(z.enum(['linear', 'radial'])),
    from: optional(color),
    to: optional(color),
    angle: optional(intBetween(0, 360)),
});

const box = object({ x: between(-20, 120), y: between(-500, 4000), w: between(0.5, 100), h: between(1, 3000) });

export const styleSchema = object({
    color: optional(color),
    background: optional(color),
    font: optional(z.enum(['heading', 'body'])),
    size: optional(intBetween(8, 160)),
    weight: optional(z.literal([300, 400, 500, 600, 700, 800])),
    align: optional(z.enum(['left', 'center', 'right'])),
    line_height: optional(between(0.8, 3)),
    radius: optional(intBetween(0, 999)),
    border_width: optional(intBetween(0, 12)),
    border_color: optional(color),
    padding: optional(intBetween(0, 80)),
    opacity: optional(between(0, 1)),
    shadow: optional(z.enum(['none', 'sm', 'md', 'lg', 'custom'])),
    shadow_custom: object({
        x: optional(intBetween(-100, 100)),
        y: optional(intBetween(-100, 100)),
        blur: optional(intBetween(0, 200)),
        spread: optional(intBetween(-50, 100)),
        color: optional(color),
        opacity: optional(between(0, 1)),
    }).nullish(),
    object_fit: optional(z.enum(['cover', 'contain'])),
    gradient: gradient.nullish(),
    background_opacity: optional(between(0, 1)),
    blur: optional(intBetween(0, 40)),
    rotate: optional(between(-180, 180)),
    flip_x: optional(z.boolean()),
    flip_y: optional(z.boolean()),
    clip: optional(z.boolean()),
    overflow: optional(z.enum(['visible', 'hidden', 'scroll-x', 'scroll-y'])),
    visible_on: optional(z.enum(['all', 'desktop', 'mobile'])),
    accent_color: optional(color),
    hover: optional(z.enum(['none', 'lift', 'grow', 'fade'])),
    animation: object({
        type: optional(z.enum(['none', 'fade', 'up', 'down', 'left', 'right', 'zoom'])),
        delay: optional(between(0, 2)),
        duration: optional(between(0.2, 2)),
    }).nullish(),
});

/** One flat bag for every core type, the shape documents already store. */
export const corePropsSchema = object({
    text: z.string().max(2000).nullish(),
    level: optional(intBetween(1, 4)),
    src: optional(image),
    alt: z.string().max(200).nullish(),
    label: z.string().max(120).nullish(),
    url: optional(httpsUrl),
    icon: optional(z.enum(ICON_NAMES)),
    sticky: optional(z.boolean()),
    scroll_style: optional(z.enum(['same', 'shadow', 'solid', 'compact'])),
    stroke: optional(between(0.5, 4)),
    accent: z.string().max(120).nullish(),
    shape: optional(z.enum(['rectangle', 'ellipse', 'triangle', 'blob', 'arch', 'diagonal', 'dots', 'grid'])),
    placeholder: z.string().max(120).nullish(),
    required: optional(z.boolean()),
    input_type: optional(z.enum(['text', 'email', 'tel', 'number', 'date'])),
    options: list(z.array(z.string().min(1).max(120)).max(30)).nullish(),
    brand: z.string().max(60).nullish(),
    layout: optional(z.enum(['split', 'left', 'center'])),
    links: list(z.array(object({
        label: z.string().min(1).max(40),
        action: object({ type: actionType, value: z.string().max(300).nullish() }),
    })).max(8)).nullish(),
    action: action.nullish(),
});

/**
 * Props are checked after the envelope, by type: core props, an app element's
 * fields, or nothing at all for a type nobody registered (kept as-is).
 */
const elementEnvelope = object({
    id,
    type: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    z: intBetween(0, 999),
    locked: optional(z.boolean()),
    group: z.string().max(40).nullish(),
    layout: object({ desktop: box, mobile: box.nullish() }),
    props: z.preprocess(emptyArrayAsObject, z.record(z.string(), z.unknown())),
    style: styleSchema,
});

const sectionSchema = object({
    id,
    group: object({
        id: z.string().max(40).nullish(),
        type: optional(z.enum(['tabs', 'steps'])),
        label: z.string().max(60).nullish(),
    }).nullish(),
    height: object({ desktop: intBetween(80, 3000), mobile: intBetween(80, 4000) }),
    background: object({
        type: z.enum(['color', 'image', 'gradient']),
        color: optional(color),
        gradient: gradient.nullish(),
        image: optional(image),
        overlay: optional(between(0, 1)),
        parallax: optional(z.boolean()),
    }),
    elements: list(z.array(elementEnvelope).max(60)),
});

const modalSchema = object({
    id,
    title: z.string().min(1).max(120),
    size: optional(z.enum(['sm', 'md', 'lg', 'xl', 'full', 'custom'])),
    show_title: optional(z.boolean()),
    width: intBetween(280, 1200),
    height: object({ desktop: intBetween(80, 2000), mobile: intBetween(80, 2400) }),
    background: object({ type: z.literal('color'), color: optional(color) }),
    elements: list(z.array(elementEnvelope).max(60)),
});

export const documentSchema = object({
    sections: list(z.array(sectionSchema).min(1).max(40)),
    modals: list(z.array(modalSchema).max(10)).nullish(),
});

export type Style = z.output<typeof styleSchema>;
export type CoreProps = z.output<typeof corePropsSchema>;
export type Action = z.output<typeof action>;
export type Box = z.output<typeof box>;
export type Gradient = z.output<typeof gradient>;
type Envelope = z.output<typeof elementEnvelope>;
type ElementBase = Omit<Envelope, 'type' | 'props'>;

export type FieldValue = string | number | boolean | Action | null;
export type CoreElement = ElementBase & { type: CoreElementType; props: CoreProps };
/** A type the app registered in its catalog. Props were checked against its fields. */
export type AppElement = ElementBase & { type: string; props: Readonly<Record<string, FieldValue | undefined>> };
/** A type nobody registered (a plugin was removed). Kept untouched so saving never deletes it; renders nothing. */
export type OpaqueElement = ElementBase & { type: string; props: Readonly<Record<string, unknown>> };
export type Element = CoreElement | AppElement | OpaqueElement;

type SectionShape = z.output<typeof sectionSchema>;
type ModalShape = z.output<typeof modalSchema>;
export type Section = Omit<SectionShape, 'elements'> & { elements: Element[] };
export type Modal = Omit<ModalShape, 'elements'> & { elements: Element[] };
export type Document = { sections: Section[]; modals?: Modal[] | null };

declare const parsedBrand: unique symbol;
/** Only the parse functions mint this, so render functions never see unchecked input. */
export type Parsed<T> = T & { readonly [parsedBrand]: true };

const coreTypes: ReadonlySet<string> = new Set(CORE_ELEMENT_TYPES);
const isCoreType = (type: string): type is CoreElementType => coreTypes.has(type);
export const isCoreElement = (element: Element): element is CoreElement => isCoreType(element.type);

export type Issue = {
    path: string;
    code: 'type' | 'range' | 'pattern' | 'enum' | 'size' | 'required';
    message: string;
};

export class DocumentError extends Error {
    readonly issues: Issue[];

    constructor(issues: Issue[]) {
        super(`Invalid document: ${issues.slice(0, 3).map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
        this.name = 'DocumentError';
        this.issues = issues;
    }
}

/** Props of a type nobody registered are kept verbatim, so only their size is bounded: UTF-8 bytes of their JSON. */
export const OPAQUE_PROPS_MAX_BYTES = 16384;
const utf8 = new TextEncoder();

/**
 * The only door into `Parsed<Document>`. Strips unknown keys (like Laravel's
 * `validated()`), rejects out-of-range values, upgrades legacy modals, and
 * keeps elements whose type is neither core nor in `catalog` as opaque.
 */
export function parseDocument(input: unknown, catalog: Catalog): Parsed<Document> {
    const envelope = check(documentSchema, upgradeLegacyModals(input), []);
    const appFields = new Map(catalog.elements.map((spec) => [spec.type, spec.fields]));
    const issues: Issue[] = [];

    const canvas = <C extends { elements: Envelope[] }>(value: C, path: (string | number)[]) => ({
        ...value,
        elements: value.elements.map((element, index) =>
            parseProps(element, appFields, [...path, 'elements', index], issues)),
    });

    const document: Document = {
        sections: envelope.sections.map((section, index) => canvas(section, ['sections', index])),
        ...(envelope.modals === undefined
            ? {}
            : { modals: envelope.modals?.map((modal, index) => canvas(modal, ['modals', index])) ?? null }),
    };

    if (issues.length > 0) {
        throw new DocumentError(issues);
    }

    return document as Parsed<Document>;
}

function parseProps(
    element: Envelope,
    appFields: ReadonlyMap<string, Field[]>,
    path: (string | number)[],
    issues: Issue[],
): Element {
    const propsPath = [...path, 'props'];

    try {
        const type = element.type;

        if (isCoreType(type)) {
            return { ...element, type, props: check(corePropsSchema, element.props, propsPath) };
        }

        const fields = appFields.get(element.type);

        if (fields) {
            // Without a prototype, a field named like an Object member (`constructor`) reads as missing when it is.
            return { ...element, props: check(fieldsSchema(fields), Object.assign(Object.create(null), element.props), propsPath) };
        }

        if (utf8.encode(JSON.stringify(element.props)).length > OPAQUE_PROPS_MAX_BYTES) {
            issues.push({ path: propsPath.join('.'), code: 'size', message: `Too big: at most ${OPAQUE_PROPS_MAX_BYTES} bytes` });
        }

        return element;
    } catch (error) {
        if (error instanceof DocumentError) {
            issues.push(...error.issues);

            return element;
        }

        throw error;
    }
}

/** Schema for an app element's props, derived from its declared fields. */
export function fieldsSchema(fields: readonly Field[]) {
    return object(Object.fromEntries(fields.map((field) => [field.key, field.kind === 'text' ? fieldSchema(field).nullish() : optional(fieldSchema(field))])));
}

function fieldSchema(field: Field) {
    switch (field.kind) {
        case 'text':
            return z.string().max(field.max);
        case 'number':
            return between(field.min, field.max);
        case 'toggle':
            return z.boolean();
        case 'choice':
            return z.enum(field.options.map((option) => option.value) as [string, ...string[]]);
        case 'image':
            return image;
        case 'action':
            return action;
    }
}

/**
 * Modals started as `{ id, title, text }` and later became canvases. Old ones
 * are upgraded here on read instead of migrating stored JSON. Every modal gets
 * the same defaults, which is what the stored data has always meant.
 */
function upgradeLegacyModals(input: unknown): unknown {
    if (!isRecord(input) || !Array.isArray(input.modals)) {
        return input;
    }

    return {
        ...input,
        modals: input.modals.map((stored: unknown) => {
            const modal = emptyArrayAsObject(stored);

            if (!isRecord(modal)) {
                return modal;
            }

            const modalId = modal.id ?? 'modal';

            return {
                ...modal,
                id: modalId,
                title: modal.title ?? 'Modal',
                size: modal.size ?? 'custom',
                show_title: modal.show_title ?? true,
                width: modal.width ?? 520,
                height: modal.height ?? { desktop: 320, mobile: 420 },
                background: modal.background ?? { type: 'color', color: 'background' },
                // A modal id that is not a string fails the schema whatever its text element is called.
                elements: modal.elements ?? legacyText(typeof modalId === 'string' ? modalId : 'modal', modal.text),
            };
        }),
    };
}

function legacyText(modalId: string, value: unknown): unknown[] {
    const text = typeof value === 'string' ? value.trim() : '';

    return text === '' ? [] : [{
        id: `${modalId}-text`,
        type: 'text',
        z: 1,
        layout: { desktop: { x: 6, y: 56, w: 88, h: 200 }, mobile: null },
        props: { text },
        style: { color: 'text', font: 'body', size: 16, line_height: 1.6 },
    }];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Fonts reach `font-family` and the Google Fonts URL, so the pattern is the injection guard. */
const font = z.string().regex(/^[A-Za-z0-9 ]{1,60}$/);

export const themeSchema = object({
    primary: optional(hex),
    secondary: optional(hex),
    background: optional(hex),
    surface: optional(hex),
    text: optional(hex),
    muted: optional(hex),
    heading_font: optional(font),
    body_font: optional(font),
    radius: optional(intBetween(0, 40)),
    max_width: optional(intBetween(900, 1600)),
});

export const defaultTheme = {
    primary: '#2563eb',
    secondary: '#0f172a',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b',
    heading_font: 'Inter',
    body_font: 'Inter',
    radius: 12,
    max_width: 1200,
};
export type Theme = typeof defaultTheme;

const seoSchema = object({
    title: z.string().max(120).nullish(),
    description: z.string().max(300).nullish(),
});
export type Seo = z.output<typeof seoSchema>;

export const siteSettingsSchema = object({
    name: z.string().min(1).max(120),
    locale: optional(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/)),
    theme: themeSchema.nullish(),
    seo: seoSchema.nullish(),
    favicon: optional(image),
    og_image: optional(image),
});

export type SiteSettings = {
    name: string;
    locale: string;
    theme: Theme;
    seo: Seo;
    favicon: string | null;
    og_image: string | null;
};

/** Missing theme keys fall back to `defaultTheme`; anything present must pass the strict pattern. */
export function parseTheme(input: unknown): Parsed<Theme> {
    const theme = check(themeSchema, input ?? {}, []);
    const fallback = defaultTheme;

    return {
        primary: theme.primary ?? fallback.primary,
        secondary: theme.secondary ?? fallback.secondary,
        background: theme.background ?? fallback.background,
        surface: theme.surface ?? fallback.surface,
        text: theme.text ?? fallback.text,
        muted: theme.muted ?? fallback.muted,
        heading_font: theme.heading_font ?? fallback.heading_font,
        body_font: theme.body_font ?? fallback.body_font,
        radius: theme.radius ?? fallback.radius,
        max_width: theme.max_width ?? fallback.max_width,
    } as Parsed<Theme>;
}

export function parseSiteSettings(input: unknown): Parsed<SiteSettings> {
    const site = check(siteSettingsSchema, input, []);
    const settings: SiteSettings = {
        name: site.name,
        locale: site.locale ?? 'en',
        theme: parseTheme(site.theme),
        seo: site.seo ?? {},
        favicon: site.favicon ?? null,
        og_image: site.og_image ?? null,
    };

    return settings as Parsed<SiteSettings>;
}


function check<S extends z.ZodType>(schema: S, input: unknown, path: (string | number)[]): z.output<S> {
    // `reportInput` keeps the input on each issue, which is how a wrong type is told apart from a missing value.
    const result = schema.safeParse(input, { reportInput: true });

    if (result.success) {
        return result.data;
    }

    const issues = result.error.issues.map((issue) => ({
        path: [...path, ...issue.path].join('.'),
        code: issueCode(issue),
        message: issue.message,
    }));
    // zod still measures the length of a value of the wrong type (a string where a list belongs); that size issue is noise.
    const mistyped = new Set(issues.filter((issue) => issue.code === 'type').map((issue) => issue.path));

    throw new DocumentError(issues.filter((issue) => issue.code !== 'size' || !mistyped.has(issue.path)));
}

function issueCode(issue: z.core.$ZodIssue): Issue['code'] {
    if (issue.input === undefined) {
        return 'required';
    }

    switch (issue.code) {
        case 'invalid_type':
            return 'type';
        case 'too_big':
        case 'too_small':
            return issue.origin === 'array' || issue.origin === 'string' ? 'size' : 'range';
        case 'invalid_format':
            return 'pattern';
        case 'invalid_value':
        case 'invalid_union':
            return 'enum';
        default:
            return 'type';
    }
}
