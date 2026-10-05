<script setup lang="ts">
import type { Box } from '@skylive/lienzo-core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRaw, watch } from 'vue';
import { boxOf, canvasHeight, findCanvas, stacksOnMobile, type Device } from '../model/document.ts';
import { anchorsOf, clamp, clampBox, dragBox, snapToAnchors, type Anchors, type Guides, type Handle } from '../model/geometry.ts';
import { fontsHref } from '../model/theme.ts';
import { issueText, useEditor } from '../state/editor.ts';
import { handleShortcut } from '../state/shortcuts.ts';
import { mountFrame, type CanvasFrame, type CanvasMetrics, type Layout, type Rect } from './frame.ts';
import Overlay from './Overlay.vue';
import { domId, renderContext, renderDraft } from './render.ts';

/**
 * The editing canvas: the page rendered by core inside an iframe at its
 * design width (the theme's max width, 390 on phones, or an open modal's
 * width), scaled to fit, with the overlay on top. Gestures move elements by
 * setting their custom properties directly and write the document once, when they end.
 */
const editor = useEditor();
const t = editor.t;
const stage = ref<HTMLElement>();
const scaler = ref<HTMLElement>();
const iframe = ref<HTMLIFrameElement>();
const stageWidth = ref(0);
const contentHeight = ref(320);
const layout = shallowRef<Layout>({ canvases: new Map(), elements: new Map() });
const hovered = ref<string | null>(null);
const guides = shallowRef<{ canvas: string; lines: Guides } | null>(null);
const live = shallowRef<ReadonlyMap<string, Rect>>(new Map());
/** The angle a rotate gesture shows before it is written. */
const rotation = shallowRef<{ id: string; value: number } | null>(null);
const hint = ref<string | null>(null);
let frame: CanvasFrame | null = null;

const PADDING = 24;
const scale = computed(() => clamp((stageWidth.value - PADDING * 2) / editor.frameWidth.value, 0.1, 1));

/** On phones, a canvas where some element has no phone box stacks: its elements cannot be dragged there. */
const frozen = computed<ReadonlySet<string>>(() => new Set(editor.state.device === 'mobile' ? editor.canvases.value.filter(stacksOnMobile).map((canvas) => canvas.id) : []));

const empty = computed(() => editor.canvases.value.every((canvas) => canvas.elements.length === 0));


let scheduled = 0;
let rendering = false;
let again = false;

function schedule() {
    if (!scheduled) {
        scheduled = requestAnimationFrame(() => {
            scheduled = 0;
            void render();
        });
    }
}

async function render() {
    // A render now would undo a gesture's live custom properties or the text being typed.
    if (!frame || rendering || editing || gesture) {
        again = true;

        return;
    }

    rendering = true;

    try {
        // Raw data: parsing walks every value, and the deep watcher already tracks changes.
        const draft = toRaw(editor.state.draft);
        const result = await renderDraft(draft, renderContext(editor), 'edit');

        if (!result.ok) {
            editor.state.renderIssues = result.issues;

            return;
        }

        editor.state.renderIssues = [];
        frame.update(result.page.body, result.page.css, draft, {
            modal: editor.state.view.kind === 'modal' ? editor.state.view.id : null,
            panels: editor.state.panels,
            fontsHref: fontsHref([editor.theme.value.heading_font, editor.theme.value.body_font]),
            emptyImage: t('canvas.emptyImage'),
            emptyVideo: t('canvas.emptyVideo'),
        });
        relayout();
    } finally {
        rendering = false;

        if (again) {
            again = false;
            schedule();
        }
    }
}

function relayout() {
    if (frame) {
        contentHeight.value = frame.contentHeight();
        layout.value = frame.measure(editor.state.draft, editor.state.device);
    }
}

watch(() => editor.state.draft, schedule, { deep: true });
watch([editor.site, () => editor.state.workspace.assets, editor.previews.version, () => editor.state.view, () => editor.state.panels], schedule);
watch([() => editor.state.device, () => editor.frameWidth.value], () => nextTick(relayout));


type Item = { id: string; start: Box };

type Gesture =
    | {
        kind: 'box';
        handle: Handle | null;
        canvas: string;
        origin: { x: number; y: number };
        /** Event pixels to frame pixels: 1 inside the iframe, 1/scale from the overlay. */
        factor: number;
        metrics: CanvasMetrics;
        anchors: Anchors;
        target: Item;
        others: Item[];
        boxes: Map<string, Box>;
    }
    | { kind: 'rotate'; id: string; center: { x: number; y: number }; startAngle: number; from: number; value: number }
    | { kind: 'radius'; id: string; origin: number; factor: number; unit: number; from: number; value: number };

let gesture: Gesture | null = null;
let release: (() => void) | null = null;

/** Captures the pointer on `node` and routes its moves to the current gesture until it ends. */
function capture(node: HTMLElement | SVGElement, event: PointerEvent) {
    node.setPointerCapture(event.pointerId);
    const move = (next: Event) => onGestureMove(next as PointerEvent);
    const end = () => finishGesture();
    const events = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;
    node.addEventListener('pointermove', move);
    events.forEach((name) => node.addEventListener(name, end));
    release = () => {
        node.removeEventListener('pointermove', move);
        events.forEach((name) => node.removeEventListener(name, end));
    };
}

function startBoxGesture(event: PointerEvent, node: HTMLElement | SVGElement, handle: Handle | null, factor: number) {
    const selection = editor.state.selection;

    if (selection.kind !== 'elements' || frozen.value.has(selection.canvas)) {
        return;
    }

    const canvas = findCanvas(editor.state.draft, selection.canvas);
    const metrics = layout.value.canvases.get(selection.canvas);
    const device = editor.state.device;
    const active = editor.activeElement.value;

    if (!canvas || !metrics || !active || active.locked || editor.kindOf(active).kind === 'opaque') {
        return;
    }

    const movable = handle ? [active] : editor.selectedElements.value.filter((element) => !element.locked);
    const ids = new Set(movable.map((element) => element.id));

    gesture = {
        kind: 'box',
        handle,
        canvas: canvas.id,
        origin: { x: event.clientX, y: event.clientY },
        factor,
        metrics,
        anchors: anchorsOf(canvas.elements.filter((element) => !ids.has(element.id)).map((element) => boxOf(element, device)), metrics.frame.w, canvasHeight(canvas, device)),
        target: { id: active.id, start: { ...boxOf(active, device) } },
        others: movable.filter((element) => element.id !== active.id).map((element) => ({ id: element.id, start: { ...boxOf(element, device) } })),
        boxes: new Map(),
    };
    capture(node, event);
}

function onGestureMove(event: PointerEvent) {
    const current = gesture;

    if (!current || !frame) {
        return;
    }

    if (current.kind === 'rotate') {
        const turned = current.from + (angle(current.center, event) - current.startAngle);
        current.value = clamp(event.shiftKey ? Math.round(turned / 15) * 15 : Math.round(turned), -180, 180);
        frame.previewVar(current.id, '--rot', current.value);
        rotation.value = { id: current.id, value: current.value };
        hint.value = `${current.value}°`;

        return;
    }

    if (current.kind === 'radius') {
        const delta = ((event.clientX - current.origin) * current.factor) / current.unit;
        current.value = Math.round(clamp(current.from + delta, 0, 200));
        frame.previewVar(current.id, '--r', current.value);
        hint.value = t('canvas.corners', { n: current.value });

        return;
    }

    const { metrics, handle, target } = current;
    const dx = (event.clientX - current.origin.x) * current.factor;
    const dy = ((event.clientY - current.origin.y) * current.factor) / metrics.unit;
    const dragged = dragBox(target.start, { x: dx, y: dy }, handle, metrics.frame.w);
    const threshold = { x: 6 / scale.value, y: 6 / (scale.value * metrics.unit) };
    const snapped = snapToAnchors(dragged, current.anchors, metrics.frame.w, threshold, handle);
    const device = editor.state.device;
    const rects = new Map<string, Rect>();
    const apply = (id: string, box: Box) => {
        current.boxes.set(id, box);
        frame?.preview(id, device, box);
        rects.set(id, {
            x: metrics.frame.x + (box.x / 100) * metrics.frame.w,
            y: metrics.frame.y + box.y * metrics.unit,
            w: (box.w / 100) * metrics.frame.w,
            h: box.h * metrics.unit,
        });
    };

    apply(target.id, snapped.box);

    for (const other of current.others) {
        apply(other.id, clampBox({ ...other.start, x: other.start.x + snapped.box.x - target.start.x, y: other.start.y + snapped.box.y - target.start.y }));
    }

    live.value = rects;
    guides.value = snapped.guides.x.length || snapped.guides.y.length ? { canvas: current.canvas, lines: snapped.guides } : null;
    hint.value = handle
        ? `${Math.round((snapped.box.w * metrics.frame.w) / 100)} × ${Math.round(snapped.box.h)} px`
        : `x ${snapped.box.x.toFixed(1)}% · y ${Math.round(snapped.box.y)} px`;
}

function finishGesture() {
    const finished = gesture;
    gesture = null;
    release?.();
    release = null;
    hint.value = null;
    guides.value = null;

    if (finished?.kind === 'box' && finished.boxes.size > 0) {
        editor.placeElements([...finished.boxes].map(([id, box]) => ({ id, box })));
    } else if (finished && finished.kind !== 'box' && finished.value !== finished.from) {
        const element = elementById(finished.id);

        if (element) {
            element.style[finished.kind === 'rotate' ? 'rotate' : 'radius'] = finished.value;
            editor.commit();
        }
    }

    live.value = new Map();
    rotation.value = null;
    schedule();
}

function elementById(id: string) {
    return editor.selectedElements.value.find((element) => element.id === id);
}

const angle = (center: { x: number; y: number }, event: PointerEvent) => (Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180) / Math.PI;

function onResize(event: PointerEvent, handle: Handle) {
    startBoxGesture(event, event.currentTarget as HTMLElement, handle, 1 / scale.value);
}

function onRotate(event: PointerEvent) {
    const element = editor.activeElement.value;
    const rect = element ? layout.value.elements.get(element.id) : undefined;
    const sheet = scaler.value?.getBoundingClientRect();

    if (!element || !rect || !sheet) {
        return;
    }

    const center = { x: sheet.left + (rect.x + rect.w / 2) * scale.value, y: sheet.top + (rect.y + rect.h / 2) * scale.value };
    const from = element.style.rotate ?? 0;
    gesture = { kind: 'rotate', id: element.id, center, startAngle: angle(center, event), from, value: from };
    capture(event.currentTarget as HTMLElement, event);
}

function onRadius(event: PointerEvent) {
    const element = editor.activeElement.value;
    const selection = editor.state.selection;
    const metrics = selection.kind === 'elements' ? layout.value.canvases.get(selection.canvas) : undefined;

    if (!element || !metrics) {
        return;
    }

    const from = element.style.radius ?? 0;
    gesture = { kind: 'radius', id: element.id, origin: event.clientX, factor: 1 / scale.value, unit: metrics.unit, from, value: from };
    capture(event.currentTarget as HTMLElement, event);
}


let editing: { node: HTMLElement; canvas: string; id: string; prop: 'text' | 'label' } | null = null;

/** Tab and step bars switch panels in the editor too; the runtime does not run here. */
function switchPanel(target: EventTarget | null): boolean {
    const button = (target as Partial<HTMLElement> | null)?.closest?.('.lz-stack-nav > button[data-go]');
    const stack = button?.closest('.lz-stack');
    const index = Number(button?.getAttribute('data-go'));
    const section = stack ? editor.state.draft.sections.find((candidate) => candidate.group?.id && `g-${domId(candidate.group.id)}` === stack.id) : undefined;

    if (!section?.group?.id || !Number.isInteger(index)) {
        return false;
    }

    editor.state.panels = { ...editor.state.panels, [section.group.id]: index };

    return true;
}

function onPointerDown(event: PointerEvent) {
    if (!frame || event.button !== 0) {
        return;
    }

    if (editing && editing.node.contains(event.target as Node)) {
        return;
    }

    finishEditing();

    if (switchPanel(event.target)) {
        return;
    }

    const hit = frame.hit(event.target);

    if (!hit) {
        editor.clearSelection();

        return;
    }

    if (hit.element === null) {
        editor.selectCanvas(hit.canvas);

        return;
    }

    event.preventDefault();
    editor.select(hit.canvas, hit.element, event.shiftKey);
    const selection = editor.state.selection;

    if (selection.kind === 'elements' && selection.ids.includes(hit.element) && !event.shiftKey) {
        startBoxGesture(event, hit.node, null, 1);
    }
}

function onDoubleClick(event: MouseEvent) {
    const hit = frame?.hit(event.target);
    const element = hit?.element ? findCanvas(editor.state.draft, hit.canvas)?.elements.find((candidate) => candidate.id === hit.element) : undefined;
    const kind = element ? editor.kindOf(element) : null;

    if (!hit || !element || kind?.kind !== 'core' || !kind.spec.inline || element.locked || editor.state.previewing) {
        return;
    }

    const node = hit.node;
    editing = { node, canvas: hit.canvas, id: element.id, prop: kind.spec.inline };
    node.setAttribute('contenteditable', 'plaintext-only');
    node.focus();
    node.ownerDocument.getSelection()?.selectAllChildren(node);
    node.addEventListener('blur', finishEditing, { once: true });
}

function finishEditing() {
    const current = editing;

    if (!current) {
        return;
    }

    editing = null;
    const text = current.node.innerText.trim();
    current.node.removeAttribute('contenteditable');
    const element = findCanvas(editor.state.draft, current.canvas)?.elements.find((candidate) => candidate.id === current.id);

    if (element) {
        (element.props as Record<string, unknown>)[current.prop] = text;
        editor.commit();
    }

    schedule();
}

function onKeyDown(event: KeyboardEvent) {
    if (editing) {
        if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Escape') {
            event.preventDefault();
            editing.node.blur();
        }

        return;
    }

    handleShortcut(editor, event);
}

function onPointerOver(event: PointerEvent) {
    const hit = frame?.hit(event.target);
    hovered.value = hit?.element ?? null;
}

/** Links, buttons and forms on the canvas never navigate or submit. */
const inert = (event: Event) => {
    if (!editing) {
        event.preventDefault();
    }
};

/**
 * Where a drop from the palette lands: the canvas under the pointer and the
 * position inside it, in design units. Null outside every canvas.
 */
function dropPoint(clientX: number, clientY: number): { canvas: string; x: number; y: number } | null {
    const box = iframe.value?.getBoundingClientRect();

    if (!frame || !box || clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) {
        return null;
    }

    const x = (clientX - box.left) / scale.value;
    const y = (clientY - box.top) / scale.value;
    const hit = frame.hit(frame.doc.elementFromPoint(x, y));
    const metrics = hit ? layout.value.canvases.get(hit.canvas) : undefined;

    if (!hit || !metrics) {
        return null;
    }

    return {
        canvas: hit.canvas,
        x: clamp(((x - metrics.frame.x) / metrics.frame.w) * 100, 0, 90),
        y: clamp((y - metrics.frame.y) / metrics.unit, 0, 3000),
    };
}

defineExpose({ dropPoint });


let stageObserver: ResizeObserver | null = null;
let frameObserver: ResizeObserver | null = null;

onMounted(() => {
    if (!iframe.value || !stage.value) {
        return;
    }

    frame = mountFrame(iframe.value);
    const doc = frame.doc;
    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('dblclick', onDoubleClick);
    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('pointerover', onPointerOver);
    doc.documentElement.addEventListener('pointerleave', () => (hovered.value = null));
    doc.addEventListener('click', inert, true);
    doc.addEventListener('submit', inert, true);

    const FrameObserver = doc.defaultView?.ResizeObserver ?? ResizeObserver;
    const observer = new FrameObserver(() => relayout());
    observer.observe(doc.body);
    frameObserver = observer;
    stageObserver = new ResizeObserver(([entry]) => {
        stageWidth.value = entry?.contentRect.width ?? 0;
    });
    stageObserver.observe(stage.value);
    schedule();
});

onBeforeUnmount(() => {
    cancelAnimationFrame(scheduled);
    stageObserver?.disconnect();
    frameObserver?.disconnect();
    release?.();
});

function generateMobile(id: string) {
    const canvas = findCanvas(editor.state.draft, id);

    if (canvas) {
        editor.generateMobile(canvas);
    }
}

const deviceName = (device: Device) => (device === 'desktop' ? t('toolbar.desktop') : t('toolbar.mobile'));
</script>

<template>
    <div ref="stage" class="lze-stage" @pointerdown.self="editor.clearSelection()">
        <p v-if="editor.state.renderIssues.length" class="lze-render-issue" role="alert">
            {{ t('canvas.invalid', { issue: issueText(editor.state.renderIssues[0]) }) }}
        </p>
        <div v-if="editor.activeModal.value" class="lze-modal-banner">
            <span>{{ t('canvas.editingModal', { title: editor.activeModal.value.title }) }}</span>
            <button type="button" class="lze-btn" @click="editor.openModal(null)">{{ t('canvas.backToPage') }}</button>
        </div>
        <div
            class="lze-sheet"
            :data-device="editor.state.device"
            :aria-label="deviceName(editor.state.device)"
            :style="{ width: `${editor.frameWidth.value * scale}px`, height: `${contentHeight * scale}px` }"
        >
            <div ref="scaler" class="lze-scaler" :style="{ width: `${editor.frameWidth.value}px`, transform: `scale(${scale})` }">
                <iframe ref="iframe" class="lze-frame" :title="t('canvas.title')" :style="{ width: `${editor.frameWidth.value}px`, height: `${contentHeight}px` }" />
                <Overlay
                    :layout="layout"
                    :scale="scale"
                    :hovered="hovered"
                    :guides="guides"
                    :live="live"
                    :rotation="rotation"
                    :frozen="frozen"
                    @resize="onResize"
                    @rotate="onRotate"
                    @radius="onRadius"
                    @generate-mobile="generateMobile"
                />
            </div>
        </div>
        <p v-if="empty" class="lze-empty-hint">{{ editor.activeModal.value ? t('canvas.emptyModal') : t('canvas.emptyPage') }}</p>
        <p v-if="hint" class="lze-hint-bubble" aria-live="polite">{{ hint }}</p>
    </div>
</template>
