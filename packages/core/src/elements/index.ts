import type { CoreElementType } from '../document.ts';
import { button } from './button.ts';
import { checkbox } from './checkbox.ts';
import type { ElementRenderer } from './context.ts';
import { divider } from './divider.ts';
import { heading } from './heading.ts';
import { icon } from './icon.ts';
import { image } from './image.ts';
import { input } from './input.ts';
import { navbar } from './navbar.ts';
import { select } from './select.ts';
import { shape } from './shape.ts';
import { text } from './text.ts';
import { textarea } from './textarea.ts';
import { video } from './video.ts';

export const coreElements = {
    heading, text, image, button, divider, video, shape, icon, navbar, input, textarea, select, checkbox,
} as const satisfies Record<CoreElementType, ElementRenderer>;
