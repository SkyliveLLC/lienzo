import { accented, type ElementRenderer } from './context.ts';

export const text: ElementRenderer = (element) => ({ tag: 'p', children: [accented(element)] });
