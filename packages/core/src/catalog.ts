/** Text in every locale the app ships. English is the fallback, so it is required. */
export type Localized = { readonly en: string } & Readonly<Record<string, string>>;

/** Closed set of field kinds. The editor renders one control per kind; parse derives the props schema from them. */
export type Field =
    | { kind: 'text'; key: string; label: Localized; max: number; multiline?: boolean; default?: string }
    | { kind: 'number'; key: string; label: Localized; min: number; max: number; step?: number; default: number }
    | { kind: 'toggle'; key: string; label: Localized; default: boolean }
    /** `multiple` stores a list of chosen values instead of one, and defaults to a list. */
    | { kind: 'choice'; key: string; label: Localized; options: { value: string; label: Localized }[]; default: string | string[]; multiple?: boolean }
    | { kind: 'image'; key: string; label: Localized }
    | { kind: 'action'; key: string; label: Localized };

export type StyleGroup = 'text' | 'fill' | 'border' | 'effects' | 'motion';

/**
 * An element type the app registers. Pure data: app elements render on the
 * backend that owns their data (see `RenderHost.appElement`).
 */
export type ElementSpec = {
    type: string;
    label: Localized;
    /** Icon catalog name for the insert menu. */
    icon: string;
    fields: Field[];
    styles: StyleGroup[];
    size: { w: number; h: number };
    /** Trusted CSS from app code, nested under `.lz-el[data-type="<type>"]` when the type is on the page. */
    css?: string;
};

/**
 * An action type the app registers; `RenderHost.action` turns it into an href.
 * Its value is stored as one string, so it cannot itself be an action.
 */
export type ActionSpec = { type: string; label: Localized; value: Exclude<Field, { kind: 'action' }> | null };

export type Catalog = {
    elements: ElementSpec[];
    actions: ActionSpec[];
    /**
     * App-specific site data (an address, opening hours, an analytics id).
     * Values live in the site's `meta` object, keyed by field key; the editor
     * renders one control per field in its site settings.
     */
    siteFields?: Field[];
};

export const emptyCatalog: Catalog = { elements: [], actions: [] };
