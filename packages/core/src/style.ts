import { THEME_TOKENS, type Style } from './document.ts';
import { num } from './html.ts';

/**
 * How each style key reaches the page. A `var` rule becomes a custom property
 * in the element's `#e-<id>{...}` block; an `attr` rule becomes a
 * `data-<attr>` attribute. `lienzo.css` consumes both, so no per-element CSS
 * is ever generated. `skip` is the value that means "not set".
 */
type VarRule = { readonly var: string; readonly kind: 'num' | 'color'; readonly skip?: number };
type AttrRule =
    | { readonly attr: string; readonly kind: 'enum'; readonly skip?: string; readonly default?: string }
    | { readonly attr: string; readonly kind: 'flag' };
type LeafRule = VarRule | AttrRule;
/** A nested style object; `requires` lists sub-keys that must all be set for any of it to apply. */
type GroupRule<K extends string> = { readonly group: { readonly [P in K]-?: LeafRule }; readonly requires?: readonly K[] };
type StyleRule<V> = V extends object ? GroupRule<keyof V & string> : LeafRule;

export const styleTable = {
    color: { var: 'c', kind: 'color' },
    background: { var: 'bg', kind: 'color' },
    font: { attr: 'font', kind: 'enum' },
    size: { var: 'fs', kind: 'num' },
    weight: { var: 'fw', kind: 'num' },
    align: { attr: 'align', kind: 'enum' },
    line_height: { var: 'lh', kind: 'num' },
    radius: { var: 'r', kind: 'num' },
    border_width: { var: 'bw', kind: 'num', skip: 0 },
    border_color: { var: 'bc', kind: 'color' },
    padding: { var: 'p', kind: 'num' },
    opacity: { var: 'op', kind: 'num' },
    shadow: { attr: 'shadow', kind: 'enum', skip: 'none' },
    shadow_custom: {
        group: {
            x: { var: 'shx', kind: 'num' },
            y: { var: 'shy', kind: 'num' },
            blur: { var: 'shb', kind: 'num' },
            spread: { var: 'shs', kind: 'num' },
            color: { var: 'shc', kind: 'color' },
            opacity: { var: 'sha', kind: 'num' },
        },
    },
    object_fit: { attr: 'fit', kind: 'enum' },
    gradient: {
        group: {
            type: { attr: 'fill', kind: 'enum', default: 'linear' },
            from: { var: 'g1', kind: 'color' },
            to: { var: 'g2', kind: 'color' },
            angle: { var: 'ga', kind: 'num' },
        },
        requires: ['from', 'to'],
    },
    background_opacity: { var: 'ba', kind: 'num' },
    blur: { var: 'blur', kind: 'num', skip: 0 },
    rotate: { var: 'rot', kind: 'num', skip: 0 },
    flip_x: { attr: 'flip-x', kind: 'flag' },
    flip_y: { attr: 'flip-y', kind: 'flag' },
    clip: { attr: 'clip', kind: 'flag' },
    pinned: { attr: 'pin', kind: 'flag' },
    overflow: { attr: 'overflow', kind: 'enum' },
    visible_on: { attr: 'visible', kind: 'enum', skip: 'all' },
    accent_color: { var: 'ac', kind: 'color' },
    hover: { attr: 'hover', kind: 'enum', skip: 'none' },
    animation: {
        group: {
            type: { attr: 'anim', kind: 'enum', skip: 'none' },
            delay: { var: 'ad', kind: 'num' },
            duration: { var: 'adur', kind: 'num' },
        },
    },
} as const satisfies { readonly [K in keyof Style]-?: StyleRule<NonNullable<Style[K]>> };

export type Vars = [name: string, value: string][];
export type DataAttrs = Record<`data-${string}`, string | true>;

const tokens: ReadonlySet<string> = new Set(THEME_TOKENS);

/** Theme tokens stay variables so the page follows palette changes. Parse guarantees a token or `#rrggbb`. */
export const cssColor = (value: string): string => (tokens.has(value) ? `var(--${value})` : value);

/** Projects a parsed style bag through the table, in table order. */
export function projectStyle(style: Style): { vars: Vars; attrs: DataAttrs } {
    const vars: Vars = [];
    const attrs: DataAttrs = {};

    const apply = (rule: LeafRule, value: unknown) => {
        if ('var' in rule) {
            if (rule.kind === 'color' && typeof value === 'string') {
                vars.push([rule.var, cssColor(value)]);
            } else if (rule.kind === 'num' && typeof value === 'number' && value !== rule.skip) {
                vars.push([rule.var, num(value)]);
            }

            return;
        }

        if (rule.kind === 'flag') {
            if (value === true) {
                attrs[`data-${rule.attr}`] = true;
            }

            return;
        }

        const resolved = value ?? rule.default;

        if (typeof resolved === 'string' && resolved !== rule.skip) {
            attrs[`data-${rule.attr}`] = resolved;
        }
    };

    for (const [key, rule] of Object.entries(styleTable)) {
        const value: unknown = style[key as keyof Style];

        if (value === null || value === undefined) {
            continue;
        }

        if (!('group' in rule)) {
            apply(rule, value);
            continue;
        }

        const group: Record<string, unknown> = { ...value };
        const requires: readonly string[] = 'requires' in rule ? rule.requires : [];

        if (requires.every((sub) => group[sub] !== null && group[sub] !== undefined)) {
            for (const [sub, leaf] of Object.entries(rule.group)) {
                apply(leaf, group[sub]);
            }
        }
    }

    return { vars, attrs };
}
