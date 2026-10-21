import type { ElementRenderer } from './context.ts';

/**
 * A box lays out what it holds instead of placing it by hand: one under the
 * other, or side by side, with a gap. The renderer fills in the children,
 * because only it knows how to draw an element.
 */
export const box: ElementRenderer = (element) => ({
    tag: 'div',
    class: 'lz-box',
    attrs: {
        'data-flow': element.props.flow === 'row' ? 'row' : 'column',
        'data-flow-align': element.props.flow_align ?? 'start',
    },
});
