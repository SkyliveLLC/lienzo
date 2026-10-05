/** Text in every locale the app ships. English is the fallback, so it is required. */
export type Localized = { readonly en: string } & Readonly<Record<string, string>>;

/** Closed set of field kinds. The editor renders one control per kind; parse derives the props schema from them. */
export type Field =
    | { kind: 'text'; key: string; label: Localized; max: number; multiline?: boolean; default?: string }
    | { kind: 'number'; key: string; label: Localized; min: number; max: number; step?: number; default: number }
    | { kind: 'toggle'; key: string; label: Localized; default: boolean }
    | { kind: 'choice'; key: string; label: Localized; options: { value: string; label: Localized }[]; default: string }
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

/** An action type the app registers; `RenderHost.action` turns it into an href. */
export type ActionSpec = { type: string; label: Localized; value: Field | null };

export type Catalog = { elements: ElementSpec[]; actions: ActionSpec[] };

export const emptyCatalog: Catalog = { elements: [], actions: [] };
