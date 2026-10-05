import { icons as catalog } from '@skylivellc/lienzo-core/data.json';

/** One stroke of a catalog icon, as core renders it. */
export type IconNode = readonly [tag: 'path' | 'circle' | 'rect' | 'line', attrs: Readonly<Record<string, string>>];

const TAGS: ReadonlySet<string> = new Set(['path', 'circle', 'rect', 'line']);

const isNode = (value: unknown): value is IconNode =>
    Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && TAGS.has(value[0])
    && typeof value[1] === 'object' && value[1] !== null && Object.values(value[1]).every((attr) => typeof attr === 'string');

function parseIcons(input: unknown): ReadonlyMap<string, readonly IconNode[]> {
    const entries = typeof input === 'object' && input !== null ? Object.entries(input) : [];

    return new Map(entries.flatMap(([name, nodes]): [string, IconNode[]][] => (Array.isArray(nodes) && nodes.every(isNode) ? [[name, nodes]] : [])));
}

/** Lienzo's icon catalog (lucide strokes), the same one public pages draw from. */
export const icons = parseIcons(catalog);
export const ICON_NAMES: readonly string[] = [...icons.keys()];
