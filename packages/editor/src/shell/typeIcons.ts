import type { CoreElementType } from '@skylive/lienzo-core';
import {
    AlignLeft,
    Image,
    ListFilter,
    Menu,
    Minus,
    MousePointerClick,
    Pilcrow,
    Sparkles,
    Square,
    SquareCheck,
    TextCursorInput,
    Type,
    Video,
} from '@lucide/vue';
import type { Component } from 'vue';

/** Icon per core type, so the palette and the layers read at a glance. */
export const typeIcons: Record<CoreElementType, Component> = {
    heading: Type,
    text: AlignLeft,
    image: Image,
    button: MousePointerClick,
    divider: Minus,
    video: Video,
    shape: Square,
    icon: Sparkles,
    navbar: Menu,
    input: TextCursorInput,
    textarea: Pilcrow,
    select: ListFilter,
    checkbox: SquareCheck,
};
