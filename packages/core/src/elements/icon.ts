import * as z from 'zod';
import { h, type TrustedHtml } from '../html.ts';
import catalog from '../icons.json' with { type: 'json' };
import type { ElementRenderer } from './context.ts';

const icons = z.record(z.string(), z.array(z.tuple([z.enum(['path', 'circle', 'rect', 'line']), z.record(z.string(), z.string())]))).parse(catalog);

/** Lucide strokes (ISC license). Inherits color and size from its box. */
export function iconSvg(name: string, stroke: number): TrustedHtml {
    const nodes = (icons[name] ?? []).map(([tag, attrs]) => h(tag, attrs));

    return h('svg', {
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': stroke,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
    }, nodes);
}

export const icon: ElementRenderer = (element, context) => {
    const svg = iconSvg(element.props.icon ?? 'star', element.props.stroke ?? 2);
    const link = context.action(element.props.action);

    return link
        ? { tag: 'a', class: 'lz-icon', attrs: { ...link, 'aria-label': element.props.label ?? element.props.icon ?? context.t.icon }, children: [svg] }
        : { tag: 'span', class: 'lz-icon', children: [svg] };
};
