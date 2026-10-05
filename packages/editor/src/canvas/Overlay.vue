<script setup lang="ts">
import { ArrowDownToLine, ArrowUpToLine, Copy, Lock, RotateCw, Trash2 } from '@lucide/vue';
import { computed } from 'vue';
import { HANDLES, type Guides, type Handle } from '../model/geometry.ts';
import { useEditor } from '../state/editor.ts';
import type { CanvasMetrics, Layout, Rect } from './frame.ts';

/**
 * Editing adornments drawn over the canvas iframe in the same design pixels:
 * selection boxes, handles, guides, the element toolbar. They are scaled
 * back up (`--inv`) so they keep their screen size at any zoom.
 */
const props = defineProps<{
    layout: Layout;
    scale: number;
    hovered: string | null;
    guides: { canvas: string; lines: Guides } | null;
    /** Elements whose box a gesture is changing, drawn from the live box. */
    live: ReadonlyMap<string, Rect>;
    /** Canvases where elements cannot be dragged (stacked on phones). */
    frozen: ReadonlySet<string>;
}>();
const emit = defineEmits<{
    resize: [event: PointerEvent, handle: Handle];
    rotate: [event: PointerEvent];
    radius: [event: PointerEvent];
    generateMobile: [canvas: string];
}>();
const editor = useEditor();
const t = editor.t;

const rectOf = (id: string): Rect | undefined => props.live.get(id) ?? props.layout.elements.get(id);

const boxes = computed(() => editor.selectedElements.value.flatMap((element) => {
    const rect = rectOf(element.id);

    return rect ? [{ element, rect, rotate: element.style.rotate ?? 0 }] : [];
}));

const single = computed(() => {
    const only = boxes.value.length === 1 ? boxes.value[0] : undefined;
    const selection = editor.state.selection;

    if (!only || only.element.locked || selection.kind !== 'elements' || props.frozen.has(selection.canvas) || editor.kindOf(only.element).kind === 'opaque') {
        return null;
    }

    return only;
});

const active = computed(() => {
    const element = editor.activeElement.value;
    const rect = element ? rectOf(element.id) : undefined;

    return element && rect ? { element, rect } : null;
});

const hoverRect = computed(() => {
    const selected = editor.selectedElements.value.some((element) => element.id === props.hovered);

    return props.hovered && !selected ? (props.layout.elements.get(props.hovered) ?? null) : null;
});

const canvasOutline = computed<CanvasMetrics | null>(() => {
    const selection = editor.state.selection;

    return selection.kind === 'canvas' ? (props.layout.canvases.get(selection.canvas) ?? null) : null;
});

const guideFrame = computed(() => (props.guides ? props.layout.canvases.get(props.guides.canvas) ?? null : null));

/** Sticky navbars get a badge: on the canvas they stay put, on the page they follow the scroll. */
const stickies = computed(() => editor.canvases.value.flatMap((canvas) => canvas.elements
    .filter((element) => element.type === 'navbar' && (element.props as { sticky?: boolean | null }).sticky === true)
    .flatMap((element) => {
        const rect = props.layout.elements.get(element.id);

        return rect ? [{ id: element.id, rect }] : [];
    })));

const stacked = computed(() => [...props.frozen].flatMap((id) => {
    const metrics = props.layout.canvases.get(id);

    return metrics ? [{ id, rect: metrics.outer }] : [];
}));

const place = (rect: Rect) => ({ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
</script>

<template>
    <div class="lze-overlay" :style="{ '--inv': String(1 / scale) }">
        <div v-if="canvasOutline" class="lze-canvas-outline" :style="place(canvasOutline.outer)" />

        <div v-if="hoverRect" class="lze-hover" :style="place(hoverRect)" />

        <div v-for="sticky in stickies" :key="sticky.id" class="lze-badge" :style="{ left: `${sticky.rect.x}px`, top: `${sticky.rect.y}px` }">{{ t('canvas.sticky') }}</div>

        <div v-for="item in stacked" :key="item.id" class="lze-stacked" :style="{ left: `${item.rect.x}px`, top: `${item.rect.y}px` }">
            <span>{{ t('canvas.stacked') }}</span>
            <button type="button" class="lze-btn" @pointerdown.stop @click="emit('generateMobile', item.id)">{{ t('section.generateMobile') }}</button>
        </div>

        <template v-if="guides && guideFrame">
            <div
                v-for="line in guides.lines.x"
                :key="`x${line}`"
                class="lze-guide"
                data-axis="x"
                :style="{ left: `${guideFrame.frame.x + line}px`, top: `${guideFrame.frame.y}px`, height: `${guideFrame.frame.h}px` }"
            />
            <div
                v-for="line in guides.lines.y"
                :key="`y${line}`"
                class="lze-guide"
                data-axis="y"
                :style="{ top: `${guideFrame.frame.y + line * guideFrame.unit}px`, left: `${guideFrame.frame.x}px`, width: `${guideFrame.frame.w}px` }"
            />
        </template>

        <div
            v-for="box in boxes"
            :key="box.element.id"
            class="lze-selection"
            :data-locked="box.element.locked === true"
            :style="{ ...place(box.rect), transform: box.rotate ? `rotate(${box.rotate}deg)` : undefined }"
        >
            <Lock v-if="box.element.locked" class="lze-lock" :size="12" aria-hidden="true" />
        </div>

        <div v-if="single" class="lze-handles" :style="{ ...place(single.rect), transform: single.rotate ? `rotate(${single.rotate}deg)` : undefined }">
            <button
                v-for="handle in HANDLES"
                :key="handle"
                type="button"
                class="lze-handle"
                :data-handle="handle"
                :aria-label="t('canvas.resize', { handle })"
                @pointerdown.stop.prevent="emit('resize', $event, handle)"
            />
            <button
                v-if="single.element.type !== 'divider'"
                type="button"
                class="lze-radius"
                :title="t('canvas.radius', { n: single.element.style.radius ?? 0 })"
                :aria-label="t('canvas.radius', { n: single.element.style.radius ?? 0 })"
                @pointerdown.stop.prevent="emit('radius', $event)"
            />
            <button
                type="button"
                class="lze-rotate"
                :title="t('canvas.rotate', { n: single.element.style.rotate ?? 0 })"
                :aria-label="t('canvas.rotate', { n: single.element.style.rotate ?? 0 })"
                @pointerdown.stop.prevent="emit('rotate', $event)"
            >
                <RotateCw :size="13" aria-hidden="true" />
            </button>
        </div>

        <div
            v-if="active && live.size === 0"
            class="lze-element-bar"
            role="toolbar"
            :aria-label="t('canvas.toolbar')"
            :data-below="active.rect.y < 56 / scale"
            :style="{ left: `${active.rect.x}px`, top: `${active.rect.y < 56 / scale ? active.rect.y + active.rect.h : active.rect.y}px` }"
            @pointerdown.stop
        >
            <button type="button" class="lze-icon-btn" :title="t('common.duplicate')" :aria-label="t('common.duplicate')" @click="editor.duplicateSelected()"><Copy :size="16" aria-hidden="true" /></button>
            <button type="button" class="lze-icon-btn" :title="t('canvas.front')" :aria-label="t('canvas.front')" @click="editor.layer('front')"><ArrowUpToLine :size="16" aria-hidden="true" /></button>
            <button type="button" class="lze-icon-btn" :title="t('canvas.back')" :aria-label="t('canvas.back')" @click="editor.layer('back')"><ArrowDownToLine :size="16" aria-hidden="true" /></button>
            <span class="lze-divider" aria-hidden="true" />
            <button type="button" class="lze-icon-btn" data-tone="danger" :title="t('common.delete')" :aria-label="t('common.delete')" @click="editor.removeSelected()"><Trash2 :size="16" aria-hidden="true" /></button>
        </div>
    </div>
</template>
