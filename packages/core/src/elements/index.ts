import type { CoreElementType } from '../document.ts';
import { button } from './button.ts';
import { checkbox } from './checkbox.ts';
import type { ElementRenderer } from './context.ts';
import { divider } from './divider.ts';
import { accordion } from './accordion.ts';
import { box } from './box.ts';
import { gallery } from './gallery.ts';
import { slider } from './slider.ts';
import { heading } from './heading.ts';
import { icon } from './icon.ts';
import { image } from './image.ts';
import { input } from './input.ts';
import { navbar } from './navbar.ts';
import { select } from './select.ts';
import { table } from './table.ts';
import { shape } from './shape.ts';
import { text } from './text.ts';
import { textarea } from './textarea.ts';
import { video } from './video.ts';

export const coreElements = {
    heading, text, image, button, divider, video, shape, icon, navbar, gallery, slider, box, accordion, table,
    input, textarea, select, checkbox,
} as const satisfies Record<CoreElementType, ElementRenderer>;
