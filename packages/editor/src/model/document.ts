import type { Box, CoreElementType, Document, Element, Modal, Section } from '@skylive/lienzo-core';

/** Lienzo designs every page twice: on a desktop frame and on a phone frame. */
export type Device = 'desktop' | 'mobile';

/** Reference width of each frame, in design pixels. Desktop follows the theme's max width. */
export const MOBILE_WIDTH = 390;

/** A section or a modal: both are free-layout canvases of elements. */
export type Canvas = Section | Modal;

export const CORE_TYPES = [
    'heading', 'text', 'image', 'button', 'divider', 'video', 'shape', 'icon', 'navbar', 'input', 'textarea', 'select', 'checkbox',
] as const satisfies readonly CoreElementType[];

const coreTypes: ReadonlySet<string> = new Set(CORE_TYPES);
export const isCoreType = (type: string): type is CoreElementType => coreTypes.has(type);

export const isModal = (canvas: Canvas): canvas is Modal => 'title' in canvas;

export function canvasesOf(document: Document): Canvas[] {
    return [...document.sections, ...(document.modals ?? [])];
}

export function findCanvas(document: Document, id: string): Canvas | undefined {
    return canvasesOf(document).find((canvas) => canvas.id === id);
}

/** The box edited on this device. A phone without its own box shows the desktop one. */
export function boxOf(element: Element, device: Device): Box {
    return device === 'desktop' ? element.layout.desktop : (element.layout.mobile ?? element.layout.desktop);
}

export function writeBox(element: Element, device: Device, box: Box): void {
    if (device === 'desktop') {
        element.layout.desktop = box;
    } else {
        element.layout.mobile = box;
    }
}

export function canvasHeight(canvas: Canvas, device: Device): number {
    return device === 'desktop' ? canvas.height.desktop : canvas.height.mobile;
}

/**
 * On a phone a canvas keeps free positions only when every element has its
 * own mobile box; otherwise core stacks its elements in reading order.
 */
export const stacksOnMobile = (canvas: Canvas): boolean => canvas.elements.some((element) => !element.layout.mobile);

/** Ids are prefixed by kind so stored documents stay readable. */
export function newId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** A fresh copy of an element with a new id, nudged down so it does not hide the original. */
export function copyElement(element: Element, offset = 24): Element {
    const copy = plain(element);

    return {
        ...copy,
        id: newId(copy.type),
        layout: { ...copy.layout, desktop: { ...copy.layout.desktop, y: copy.layout.desktop.y + offset } },
    };
}

/** A deep copy as plain data, also out of a reactive proxy. Documents are JSON by definition. */
export function plain<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
