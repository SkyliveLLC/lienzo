import { accented, type ElementRenderer } from './context.ts';

const levels = ['h1', 'h2', 'h3', 'h4'] as const;

export const heading: ElementRenderer = (element) => ({
    tag: levels[(element.props.level ?? 2) - 1] ?? 'h2',
    children: [accented(element)],
});
