import type { Box } from '@skylive/lienzo-core';

/**
 * Layout math of the canvas, in design units: x and w are percent of the
 * frame width, y and h are design pixels. Pure, so the canvas gestures and
 * the panels share one copy and the tests drive it directly.
 */

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export type Alignment = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom';
export const ALIGNMENTS: readonly Alignment[] = ['left', 'hcenter', 'right', 'top', 'vmiddle', 'bottom'];

/** Guide lines that matched, in design pixels from the frame's left and top edges. */
export type Guides = { x: number[]; y: number[] };

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Rounds to a grid, 4 design pixels by default, so nothing sits on half a pixel. */
export const snap = (value: number, grid = 4): number => Math.round(value / grid) * grid;

/** Keeps a box inside the ranges a document accepts, with room to bleed off the edges. */
export const clampBox = (box: Box): Box => ({
    x: clamp(box.x, -10, 110),
    y: clamp(box.y, -400, 3000),
    w: clamp(box.w, 0.5, 100),
    h: clamp(box.h, 1, 3000),
});

/**
 * The box after dragging by `delta` design pixels: the whole box when
 * `handle` is null, otherwise the edges that handle owns. x snaps to half a
 * percent and y to the 4px grid.
 */
export function dragBox(start: Box, delta: { x: number; y: number }, handle: Handle | null, frameWidth: number): Box {
    const percent = (value: number) => (value / frameWidth) * 100;
    const box = { ...start };

    if (handle === null) {
        box.x = snap(start.x + percent(delta.x), 0.5);
        box.y = snap(start.y + delta.y);
    } else {
        if (handle.includes('e')) {
            box.w = start.w + percent(delta.x);
        }
        if (handle.includes('s')) {
            box.h = snap(start.h + delta.y);
        }
        if (handle.includes('w')) {
            box.x = snap(start.x + percent(delta.x), 0.5);
            box.w = start.w - percent(delta.x);
        }
        if (handle.includes('n')) {
            box.y = snap(start.y + delta.y);
            box.h = snap(start.h - delta.y);
        }
        box.w = snap(box.w, 0.5);
    }

    return clampBox(box);
}

/** Edges and centers worth aligning to: the frame's, then every other element's. */
export type Anchors = { x: number[]; y: number[] };

export function anchorsOf(others: readonly Box[], frameWidth: number, frameHeight: number): Anchors {
    const x = [0, frameWidth / 2, frameWidth];
    const y = [0, frameHeight / 2, frameHeight];

    for (const box of others) {
        const left = (box.x / 100) * frameWidth;
        const width = (box.w / 100) * frameWidth;
        x.push(left, left + width / 2, left + width);
        y.push(box.y, box.y + box.h / 2, box.y + box.h);
    }

    return { x, y };
}

/** The smallest move that puts one of `edges` on one of `targets`, within `threshold`. */
function nearest(edges: readonly number[], targets: readonly number[], threshold: number): { shift: number; line: number } | null {
    let best: { shift: number; line: number } | null = null;

    for (const edge of edges) {
        for (const target of targets) {
            const shift = target - edge;

            if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) {
                best = { shift, line: target };
            }
        }
    }

    return best;
}

/**
 * Pulls the box onto nearby anchors, like design tools do, and reports the
 * lines that matched. Moving snaps all three edges per axis; resizing snaps
 * only the edges the handle moves. Thresholds are in the units of each axis.
 */
export function snapToAnchors(
    box: Box,
    anchors: Anchors,
    frameWidth: number,
    threshold: { x: number; y: number },
    handle: Handle | null,
): { box: Box; guides: Guides } {
    const next = { ...box };
    const left = (box.x / 100) * frameWidth;
    const width = (box.w / 100) * frameWidth;
    const guides: Guides = { x: [], y: [] };

    const horizontal = handle
        ? handle.includes('e') ? [left + width] : handle.includes('w') ? [left] : []
        : [left, left + width / 2, left + width];
    const vertical = handle
        ? handle.includes('s') ? [box.y + box.h] : handle.includes('n') ? [box.y] : []
        : [box.y, box.y + box.h / 2, box.y + box.h];

    const x = nearest(horizontal, anchors.x, threshold.x);
    const y = nearest(vertical, anchors.y, threshold.y);

    if (x) {
        const shift = (x.shift / frameWidth) * 100;
        guides.x.push(x.line);

        if (!handle) {
            next.x += shift;
        } else if (handle.includes('e')) {
            next.w += shift;
        } else {
            next.x += shift;
            next.w -= shift;
        }
    }

    if (y) {
        guides.y.push(y.line);

        if (!handle) {
            next.y += y.shift;
        } else if (handle.includes('s')) {
            next.h += y.shift;
        } else {
            next.y += y.shift;
            next.h -= y.shift;
        }
    }

    return { box: next, guides };
}

/** Aligns one box inside its canvas. */
export function alignInCanvas(box: Box, where: Alignment, canvasHeight: number): Box {
    switch (where) {
        case 'left':
            return { ...box, x: 0 };
        case 'hcenter':
            return { ...box, x: Math.round(((100 - box.w) / 2) * 2) / 2 };
        case 'right':
            return { ...box, x: 100 - box.w };
        case 'top':
            return { ...box, y: 0 };
        case 'vmiddle':
            return { ...box, y: snap((canvasHeight - box.h) / 2) };
        case 'bottom':
            return { ...box, y: snap(canvasHeight - box.h) };
    }
}

/** Aligns several boxes against the box that encloses all of them. */
export function alignTogether(boxes: readonly Box[], where: Alignment): Box[] {
    const left = Math.min(...boxes.map((box) => box.x));
    const right = Math.max(...boxes.map((box) => box.x + box.w));
    const top = Math.min(...boxes.map((box) => box.y));
    const bottom = Math.max(...boxes.map((box) => box.y + box.h));

    return boxes.map((box) => {
        switch (where) {
            case 'left':
                return { ...box, x: left };
            case 'hcenter':
                return { ...box, x: (left + right) / 2 - box.w / 2 };
            case 'right':
                return { ...box, x: right - box.w };
            case 'top':
                return { ...box, y: top };
            case 'vmiddle':
                return { ...box, y: snap((top + bottom) / 2 - box.h / 2) };
            case 'bottom':
                return { ...box, y: snap(bottom - box.h) };
        }
    });
}

/**
 * Spreads boxes evenly between the first and the last along one axis.
 * Needs three or more; returns the boxes in their original order.
 */
export function distribute(boxes: readonly Box[], axis: 'x' | 'y'): Box[] {
    if (boxes.length < 3) {
        return [...boxes];
    }

    const order = boxes.map((box, index) => ({ box, index })).sort((a, b) => a.box[axis] - b.box[axis]);
    const first = order[0]!.box[axis];
    const step = (order[order.length - 1]!.box[axis] - first) / (order.length - 1);
    const result = [...boxes];

    order.forEach(({ box, index }, position) => {
        if (position > 0 && position < order.length - 1) {
            const value = first + step * position;
            result[index] = { ...box, [axis]: axis === 'x' ? value : snap(value) };
        }
    });

    return result;
}

/** The layer that puts an element above (or below) every other one in its canvas. */
export function frontLayer(others: readonly number[]): number {
    return Math.min(999, Math.max(0, ...others) + 1);
}

export function backLayer(others: readonly number[]): number {
    return Math.max(0, Math.min(1, ...others) - 1);
}

/** Canvas height that fits its content, with a margin below the lowest element. */
export function fitHeight(boxes: readonly Box[]): number {
    const bottom = boxes.reduce((lowest, box) => Math.max(lowest, box.y + box.h), 0);

    return Math.max(80, snap(bottom + 64));
}

/**
 * A phone layout from the desktop one: elements one below the other in
 * reading order (top to bottom, then left to right), 92% wide, heights scaled
 * with the width so proportions hold. Text never shrinks below its desktop
 * height, since it wraps into more lines.
 */
export function stackForMobile(
    elements: readonly { desktop: Box; text: boolean }[],
    reference: number,
    mobileWidth: number,
): { boxes: Box[]; height: number } {
    const order = elements
        .map((element, index) => ({ ...element, index }))
        .sort((a, b) => a.desktop.y - b.desktop.y || a.desktop.x - b.desktop.x);
    const boxes: Box[] = new Array(elements.length);
    let top = 32;

    for (const element of order) {
        const width = 92;
        const factor = ((width / 100) * mobileWidth) / ((element.desktop.w / 100) * reference);
        const height = clamp(snap(element.desktop.h * (element.text ? Math.max(1, factor) : factor)), 24, 3000);

        boxes[element.index] = { x: 4, y: snap(top), w: width, h: height };
        top += height + 20;
    }

    return { boxes, height: clamp(snap(top + 12), 200, 4000) };
}
