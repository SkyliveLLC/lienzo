import { text } from '../html.ts';
import type { ElementRenderer } from './context.ts';

export const button: ElementRenderer = (element, context) =>
    element.props.action?.type === 'submit'
        ? { tag: 'button', attrs: { type: 'submit' }, children: [text(element.props.label ?? context.t.submit)] }
        : { tag: 'a', attrs: context.action(element.props.action) ?? {}, children: [text(element.props.label ?? '')] };
