import { describe, expect, it } from 'vitest';
import { alignInCanvas, alignTogether, anchorsOf, distribute, dragBox, fitHeight, snapToAnchors, stackForMobile } from '../src/model/geometry.ts';

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

describe('dragBox', () => {
    it('moves the whole box on the half-percent and 4px grids', () => {
        // 1200px frame: 30px is 2.5%, 13px down snaps to 12.
        expect(dragBox(box(10, 100, 40, 80), { x: 30, y: 13 }, null, 1200)).toEqual(box(12.5, 112, 40, 80));
    });

    it('resizes only the edges a handle owns', () => {
        expect(dragBox(box(10, 100, 40, 80), { x: 120, y: 40 }, 'se', 1200)).toEqual(box(10, 100, 50, 120));
        expect(dragBox(box(10, 100, 40, 80), { x: 120, y: 40 }, 'nw', 1200)).toEqual(box(20, 140, 30, 40));
    });

    it('never produces a box the document would reject', () => {
        const result = dragBox(box(10, 100, 40, 80), { x: 5000, y: -9000 }, 'n', 1200);

        expect(result.y).toBe(-400);
        expect(dragBox(box(10, 100, 2, 80), { x: -600, y: 0 }, 'e', 1200).w).toBe(0.5);
    });
});

describe('snapToAnchors', () => {
    const anchors = anchorsOf([box(50, 200, 25, 100)], 1000, 600);
    const threshold = { x: 6, y: 6 };

    it('pulls a moving box onto the nearest edge or center and reports the line', () => {
        // Left edge at 497px is 3px from the other box's left edge at 500px.
        const { box: snapped, guides } = snapToAnchors(box(49.7, 50, 10, 40), anchors, 1000, threshold, null);

        expect(snapped.x).toBeCloseTo(50);
        expect(guides.x).toEqual([500]);
        expect(guides.y).toEqual([]);
    });

    it('snaps the bottom edge when resizing from the south handle, without moving the box', () => {
        const { box: snapped, guides } = snapToAnchors(box(5, 150, 10, 147), anchors, 1000, threshold, 's');

        expect(snapped).toEqual(box(5, 150, 10, 150));
        expect(guides.y).toEqual([300]);
    });

    it('leaves a box alone when nothing is within the threshold', () => {
        const start = box(20, 420, 10, 40);

        expect(snapToAnchors(start, anchors, 1000, threshold, null)).toEqual({ box: start, guides: { x: [], y: [] } });
    });
});

describe('alignment', () => {
    it('aligns one box inside its canvas', () => {
        expect(alignInCanvas(box(10, 10, 30, 100), 'hcenter', 500).x).toBe(35);
        expect(alignInCanvas(box(10, 10, 30, 100), 'bottom', 500).y).toBe(400);
    });

    it('aligns several boxes against the box enclosing them', () => {
        const aligned = alignTogether([box(10, 0, 20, 50), box(40, 100, 10, 50)], 'right');

        expect(aligned.map((item) => item.x)).toEqual([30, 40]);
    });

    it('spreads the middle boxes evenly and keeps the original order', () => {
        const spread = distribute([box(80, 0, 5, 5), box(0, 0, 5, 5), box(10, 0, 5, 5)], 'x');

        expect(spread.map((item) => item.x)).toEqual([80, 0, 40]);
    });
});

describe('canvas helpers', () => {
    it('fits the height below the lowest element', () => {
        expect(fitHeight([box(0, 100, 10, 50), box(0, 300, 10, 41)])).toBe(404);
        expect(fitHeight([])).toBe(80);
    });

    it('stacks a desktop layout for phones in reading order', () => {
        const { boxes, height } = stackForMobile([
            { desktop: box(50, 0, 40, 100), text: false },
            { desktop: box(5, 0, 40, 60), text: true },
            { desktop: box(5, 300, 92, 100), text: false },
        ], 1200, 390);

        // Same row: the left one first.
        expect(boxes[1]?.y).toBeLessThan(boxes[0]?.y ?? 0);
        expect(boxes.every((item) => item.x === 4 && item.w === 92)).toBe(true);
        // Text never gets shorter than on desktop.
        expect(boxes[1]?.h).toBe(60);
        expect(height).toBeGreaterThan(boxes[2]!.y + boxes[2]!.h);
    });
});
