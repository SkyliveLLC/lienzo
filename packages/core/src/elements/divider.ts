import type { ElementRenderer } from './context.ts';

export const divider: ElementRenderer = () => ({ tag: 'hr', class: 'lz-divider' });
