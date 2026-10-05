import type { ElementRenderer } from './context.ts';

export const shape: ElementRenderer = (element) => ({
    tag: 'div',
    attrs: { 'aria-hidden': 'true', 'data-shape': element.props.shape },
});
