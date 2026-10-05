import lienzoCss from '@skylive/lienzo-core/lienzo.css?raw';
import type { Box, Document as Draft } from '@skylive/lienzo-core';
import { canvasesOf, type Device } from '../model/document.ts';
import { frameCss } from './frameCss.ts';
import { domId } from './render.ts';

/** A rectangle in the iframe document, in CSS pixels of the design frame. */
export type Rect = { x: number; y: number; w: number; h: number };

/** Where a canvas sits on screen and how its design units map to pixels. */
export type CanvasMetrics = {
    /** The canvas's `.lz-frame`: the box element positions are relative to. */
    frame: Rect;
    /** Pixels per design pixel vertically (`--u`). */
    unit: number;
    /** The section or the modal dialog, for outlines. */
    outer: Rect;
};

export type Layout = {
    canvases: ReadonlyMap<string, CanvasMetrics>;
    elements: ReadonlyMap<string, Rect>;
};

export type FrameView = {
    /** The modal shown instead of the page, or null for the page. */
    modal: string | null;
    /** Visible panel per tab or step group. */
    panels: Readonly<Record<string, number>>;
    fontsHref: string;
    emptyImage: string;
    emptyVideo: string;
};

/** Which canvas or element a rendered node belongs to, by the id core gave it. */
type Lookup = { canvases: Map<string, string>; elements: Map<string, { canvas: string; element: string }> };

/**
 * The canvas iframe: a blank same-origin document holding `lienzo.css`, the
 * editor overrides and the page body core rendered. `update` patches only
 * the top-level blocks whose markup changed, so untouched sections keep
 * their DOM (no video reloads, no image flashes) while one is edited.
 */
export function mountFrame(iframe: HTMLIFrameElement) {
    const found = iframe.contentDocument;

    if (!found) {
        throw new Error('The canvas iframe has no document');
    }

    const doc: globalThis.Document = found;

    doc.open();
    doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body class="lz-page"></body></html>');
    doc.close();

    const View = doc.defaultView?.CSSStyleSheet ?? CSSStyleSheet;
    const sheet = (css: string) => {
        const created = new View();
        created.replaceSync(css);

        return created;
    };
    const pageSheet = sheet('');
    doc.adoptedStyleSheets = [sheet(lienzoCss), pageSheet, sheet(frameCss)];

    const fonts = doc.createElement('link');
    fonts.rel = 'stylesheet';
    doc.head.append(fonts);

    const body = doc.body;
    let rendered = new Map<string, string>();
    let lookup: Lookup = { canvases: new Map(), elements: new Map() };

    function update(html: string, css: string, document: Draft, view: FrameView) {
        pageSheet.replaceSync(css);

        if (fonts.href !== view.fontsHref) {
            fonts.href = view.fontsHref;
        }

        body.style.setProperty('--lze-empty-image', JSON.stringify(view.emptyImage));
        body.style.setProperty('--lze-empty-video', JSON.stringify(view.emptyVideo));
        patch(html);
        lookup = lookupOf(document);

        body.toggleAttribute('data-lze-modal', view.modal !== null);
        body.querySelectorAll('dialog.lz-modal').forEach((dialog) => {
            dialog.toggleAttribute('data-lze-open', view.modal !== null && dialog.id === `m-${domId(view.modal)}`);
        });

        body.querySelectorAll<HTMLElement>('.lz-stack').forEach((stack) => {
            const groupId = groupIdOf(stack.id, document);
            const index = groupId === null ? 0 : (view.panels[groupId] ?? 0);
            stack.querySelectorAll(':scope > .lz-stack-panels > .lz-stack-panel').forEach((panel, position) => panel.toggleAttribute('data-on', position === index));
            stack.querySelectorAll(':scope > .lz-stack-nav > button').forEach((button, position) => button.setAttribute('aria-pressed', String(position === index)));
        });
    }

    /**
     * Replaces only the top-level blocks whose markup changed, keyed by their
     * id. Moving or restyling an element changes the stylesheet, not the
     * markup, so most edits replace nothing at all.
     */
    function patch(html: string) {
        const template = doc.createElement('template');
        template.innerHTML = html;
        const current = new Map([...body.children].map((node) => [node.id, node]));
        const next = new Map<string, string>();
        const nodes = [...template.content.children].map((node) => {
            const markup = node.outerHTML;
            const existing = current.get(node.id);
            const reusable = existing !== undefined && node.id !== '' && rendered.get(node.id) === markup;
            next.set(node.id, markup);

            return reusable ? existing : doc.importNode(node, true);
        });

        nodes.forEach((node, index) => {
            if (body.children[index] !== node) {
                body.insertBefore(node, body.children[index] ?? null);
            }
        });

        while (body.children.length > nodes.length) {
            body.lastElementChild?.remove();
        }

        // Gestures move elements with inline custom properties; the stylesheet is the truth again.
        body.querySelectorAll('.lz-el[style]').forEach((node) => node.removeAttribute('style'));
        rendered = next;
    }

    function groupIdOf(stackId: string, document: Draft): string | null {
        const section = document.sections.find((candidate) => candidate.group?.id && `g-${domId(candidate.group.id)}` === stackId);

        return section?.group?.id ?? null;
    }

    function lookupOf(document: Draft): Lookup {
        const next: Lookup = { canvases: new Map(), elements: new Map() };

        for (const canvas of canvasesOf(document)) {
            next.canvases.set(domId(canvas.id), canvas.id);

            for (const element of canvas.elements) {
                next.elements.set(domId(element.id), { canvas: canvas.id, element: element.id });
            }
        }

        return next;
    }

    const elementNode = (id: string) => doc.getElementById(`e-${domId(id)}`);

    /** The section, or the modal dialog, of a canvas. */
    const canvasNode = (id: string): HTMLElement | null => doc.getElementById(`s-${domId(id)}`) ?? doc.getElementById(`m-${domId(id)}`);

    const frameNode = (id: string): HTMLElement | null => canvasNode(id)?.querySelector<HTMLElement>('.lz-frame') ?? null;

    /** What a node in the canvas belongs to: an element (innermost first), else a canvas. */
    function hit(target: EventTarget | null): { canvas: string; element: string | null; node: HTMLElement } | null {
        const start = isNode(target) ? (target.nodeType === 1 ? (target as globalThis.Element) : target.parentElement) : null;
        const elementNodeHit = start?.closest<HTMLElement>('.lz-el');
        const element = elementNodeHit ? lookup.elements.get(elementNodeHit.id.slice(2)) : undefined;

        if (elementNodeHit && element) {
            return { canvas: element.canvas, element: element.element, node: elementNodeHit };
        }

        const canvasHit = start?.closest<HTMLElement>('.lz-section, dialog.lz-modal');
        const canvas = canvasHit ? lookup.canvases.get(canvasHit.id.slice(2)) : undefined;

        return canvasHit && canvas ? { canvas, element: null, node: canvasHit } : null;
    }

    const rectOf = (node: HTMLElement): Rect => {
        const box = node.getBoundingClientRect();

        return { x: box.left + doc.documentElement.scrollLeft, y: box.top + doc.documentElement.scrollTop, w: box.width, h: box.height };
    };

    /**
     * Measures every visible canvas and element. Element boxes come from
     * offsets inside their frame, which ignore transforms, so a rotated
     * element measures as its unrotated box (the overlay rotates it back).
     */
    function measure(document: Draft, device: Device): Layout {
        const canvases = new Map<string, CanvasMetrics>();
        const elements = new Map<string, Rect>();

        for (const canvas of canvasesOf(document)) {
            const outer = canvasNode(canvas.id);
            const frame = frameNode(canvas.id);

            if (!outer || !frame || frame.offsetParent === null) {
                continue;
            }

            const frameRect = rectOf(frame);
            const height = device === 'desktop' ? canvas.height.desktop : canvas.height.mobile;
            canvases.set(canvas.id, { frame: frameRect, unit: frame.hasAttribute('data-stack') && device === 'mobile' ? frameRect.w / 390 : frameRect.h / height, outer: rectOf(outer) });

            for (const element of canvas.elements) {
                const node = elementNode(element.id);

                if (node && node.offsetParent !== null) {
                    elements.set(element.id, { x: frameRect.x + node.offsetLeft, y: frameRect.y + node.offsetTop, w: node.offsetWidth, h: node.offsetHeight });
                }
            }
        }

        return { canvases, elements };
    }

    /** Moves an element on screen during a gesture, before the document changes. */
    function preview(id: string, device: Device, box: Box) {
        const node = elementNode(id);
        const [x, y, w, h] = device === 'desktop' ? ['--x', '--y', '--w', '--h'] : ['--mx', '--my', '--mw', '--mh'];
        node?.style.setProperty(x, String(box.x));
        node?.style.setProperty(y, String(box.y));
        node?.style.setProperty(w, String(box.w));
        node?.style.setProperty(h, String(box.h));
    }

    return {
        doc,
        update,
        measure,
        hit,
        preview,
        /** Sets one custom property on an element during a gesture (rotation, corners). */
        previewVar: (id: string, name: string, value: number) => elementNode(id)?.style.setProperty(name, String(value)),
        contentHeight: () => doc.documentElement.scrollHeight,
    };
}

export type CanvasFrame = ReturnType<typeof mountFrame>;

/** Nodes from the iframe belong to another realm, so `instanceof Node` would be false. */
const isNode = (value: EventTarget | null): value is Node => value !== null && typeof (value as Partial<Node>).nodeType === 'number';
