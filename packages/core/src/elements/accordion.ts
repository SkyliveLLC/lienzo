import { h, text } from '../html.ts';
import type { ElementRenderer } from './context.ts';

/**
 * Questions that fold. Built on `details`, so one opens without JavaScript,
 * the browser finds the text when someone searches the page, and a reader
 * that cannot see still hears what is folded.
 */
export const accordion: ElementRenderer = (element) => ({
    tag: 'div',
    class: 'lz-accordion',
    children: (element.props.items ?? []).map((item) => h('details', { class: 'lz-fold' }, [
        h('summary', {}, [text(item.title)]),
        h('p', {}, [text(item.text ?? '')]),
    ])),
});
