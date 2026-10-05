<script setup lang="ts">
import type { CoreElementType } from '@skylive/lienzo-core';
import { ChevronDown, ChevronUp, Frame, Image as ImageIcon, Layers, Lock, LockOpen, PanelTop, Plus, Trash2 } from '@lucide/vue';
import { computed, ref } from 'vue';
import { CORE_TYPES, isModal } from '../model/document.ts';
import { coreSpecs, elementName, type Insertable } from '../model/elements.ts';
import { buildSectionTemplate, SECTION_TEMPLATES } from '../model/templates.ts';
import { useEditor } from '../state/editor.ts';
import CatalogIcon from '../ui/CatalogIcon.vue';
import ElementIcon from './ElementIcon.vue';
import { typeIcons } from './typeIcons.ts';

/** Left sidebar: what to add, the layer tree, the modals, and the media library. */
const props = defineProps<{ dropPoint: (clientX: number, clientY: number) => { canvas: string; x: number; y: number } | null }>();
const editor = useEditor();
const t = editor.t;

type Tab = 'elements' | 'layers' | 'modals' | 'media';
const tab = ref<Tab>('elements');
const tabs = [
    { key: 'elements', label: 'tabs.elements', icon: Plus },
    { key: 'layers', label: 'tabs.layers', icon: Layers },
    { key: 'modals', label: 'tabs.modals', icon: PanelTop },
    { key: 'media', label: 'tabs.media', icon: ImageIcon },
] as const;

const contentTypes = CORE_TYPES.filter((type) => coreSpecs[type].group === 'content');
const formTypes = CORE_TYPES.filter((type) => coreSpecs[type].group === 'form');


const dragging = ref<{ insertable: Insertable; src?: string; label: string; x: number; y: number; moved: boolean } | null>(null);

function startDrag(event: PointerEvent, insertable: Insertable, label: string, src?: string) {
    if (event.button !== 0) {
        return;
    }

    dragging.value = { insertable, src, label, x: event.clientX, y: event.clientY, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveDrag(event: PointerEvent) {
    const held = dragging.value;

    if (held) {
        const moved = held.moved || Math.hypot(event.clientX - held.x, event.clientY - held.y) > 4;
        dragging.value = { ...held, x: event.clientX, y: event.clientY, moved };
    }
}

/** Dropped on a canvas, the element is born right there; a plain click adds it to the current canvas. */
function drop(event: PointerEvent) {
    const held = dragging.value;
    dragging.value = null;

    if (!held) {
        return;
    }

    const spot = held.moved ? props.dropPoint(event.clientX, event.clientY) : null;

    if (held.moved && !spot) {
        return;
    }

    editor.addElement(held.insertable, spot ?? undefined, held.src);
}

/** Keyboard activation (a click with no pointer behind it) adds the element; pointers go through the drag. */
function pressed(event: MouseEvent, insertable: Insertable, src?: string) {
    if (event.detail === 0) {
        editor.addElement(insertable, undefined, src);
    }
}

const coreLabel = (type: CoreElementType) => t(coreSpecs[type].label);


const collapsed = ref<string[]>([]);

function toggleCollapsed(id: string) {
    collapsed.value = collapsed.value.includes(id) ? collapsed.value.filter((item) => item !== id) : [...collapsed.value, id];
}

const selectedIds = computed(() => (editor.state.selection.kind === 'elements' ? editor.state.selection.ids : []));
const canvasSelected = (id: string) => editor.state.selection.kind === 'canvas' && editor.state.selection.canvas === id;

function layerLabel(element: Parameters<typeof elementName>[0]): string {
    const kind = editor.kindOf(element);

    return elementName(element, kind.kind === 'core' ? t(kind.spec.label) : kind.kind === 'app' ? editor.i18n.localized(kind.spec.label) : t('type.unknown'));
}

function toggleLocked(element: { locked?: boolean | null }) {
    element.locked = !element.locked;
    editor.commit();
}

const modals = computed(() => editor.state.draft.modals ?? []);
</script>

<template>
    <aside class="lze-sidebar lze-left">
        <div class="lze-tabs" role="tablist">
            <button
                v-for="item in tabs"
                :key="item.key"
                type="button"
                role="tab"
                :aria-selected="tab === item.key"
                @click="tab = item.key"
            >
                <component :is="item.icon" :size="16" aria-hidden="true" />{{ t(item.label) }}
            </button>
        </div>

        <div v-if="tab === 'elements'" class="lze-scroll lze-stack" role="tabpanel">
            <div class="lze-palette">
                <button
                    v-for="type in contentTypes"
                    :key="type"
                    type="button"
                    class="lze-palette-item"
                    :title="t('elements.addHint')"
                    @pointerdown="startDrag($event, { kind: 'core', type }, coreLabel(type))"
                    @click="pressed($event, { kind: 'core', type })"
                    @pointermove="moveDrag"
                    @pointerup="drop"
                    @pointercancel="dragging = null"
                >
                    <component :is="typeIcons[type]" :size="16" aria-hidden="true" />{{ coreLabel(type) }}
                </button>
            </div>

            <template v-if="editor.catalog.value.elements.length">
                <p class="lze-group-title">{{ t('elements.app') }}</p>
                <div class="lze-palette">
                    <button
                        v-for="spec in editor.catalog.value.elements"
                        :key="spec.type"
                        type="button"
                        class="lze-palette-item"
                        :title="t('elements.addHint')"
                        @pointerdown="startDrag($event, { kind: 'app', spec }, editor.i18n.localized(spec.label))"
                        @click="pressed($event, { kind: 'app', spec })"
                        @pointermove="moveDrag"
                        @pointerup="drop"
                        @pointercancel="dragging = null"
                    >
                        <CatalogIcon :name="spec.icon" :size="16" />{{ editor.i18n.localized(spec.label) }}
                    </button>
                </div>
                <p class="lze-hint">{{ t('elements.appHint') }}</p>
            </template>

            <p class="lze-group-title">{{ t('elements.sections') }}</p>
            <div class="lze-list">
                <button v-for="template in SECTION_TEMPLATES" :key="template.key" type="button" class="lze-list-item" @click="editor.addSection(buildSectionTemplate(template.key))">
                    {{ t(template.name) }}
                </button>
            </div>

            <p class="lze-group-title">{{ t('elements.form') }}</p>
            <div class="lze-palette">
                <button
                    v-for="type in formTypes"
                    :key="type"
                    type="button"
                    class="lze-palette-item"
                    :title="t('elements.addHint')"
                    @pointerdown="startDrag($event, { kind: 'core', type }, coreLabel(type))"
                    @click="pressed($event, { kind: 'core', type })"
                    @pointermove="moveDrag"
                    @pointerup="drop"
                    @pointercancel="dragging = null"
                >
                    <component :is="typeIcons[type]" :size="16" aria-hidden="true" />{{ coreLabel(type) }}
                </button>
            </div>
            <p class="lze-hint">{{ t('elements.formHint') }}</p>
        </div>

        <div v-else-if="tab === 'layers'" class="lze-scroll" role="tabpanel">
            <div class="lze-heading lze-pad">
                <span class="lze-muted">{{ editor.activeModal.value ? t('layers.modal', { title: editor.activeModal.value.title }) : t('layers.count', { n: editor.state.draft.sections.length }) }}</span>
                <button v-if="!editor.activeModal.value" type="button" class="lze-btn" data-variant="ghost" @click="editor.addSection()"><Plus :size="14" aria-hidden="true" />{{ t('common.new') }}</button>
            </div>
            <div v-for="(canvas, index) in editor.canvases.value" :key="canvas.id" class="lze-layer-group">
                <div class="lze-layer-row" :data-selected="canvasSelected(canvas.id)">
                    <button type="button" class="lze-icon-btn" :aria-label="collapsed.includes(canvas.id) ? t('layers.expand') : t('layers.collapse')" @click="toggleCollapsed(canvas.id)">
                        <ChevronDown :size="14" :style="{ transform: collapsed.includes(canvas.id) ? 'rotate(-90deg)' : undefined }" aria-hidden="true" />
                    </button>
                    <button type="button" class="lze-layer-name" @click="editor.selectCanvas(canvas.id)">
                        <Frame :size="14" aria-hidden="true" />
                        <span>{{ isModal(canvas) ? canvas.title : t('layers.section', { n: index + 1 }) }}</span>
                        <span class="lze-muted">{{ canvas.elements.length }}</span>
                    </button>
                    <span v-if="!isModal(canvas)" class="lze-layer-actions">
                        <button type="button" class="lze-icon-btn" :aria-label="t('layers.up')" :disabled="index === 0" @click="editor.moveSection(index, -1)"><ChevronUp :size="14" aria-hidden="true" /></button>
                        <button type="button" class="lze-icon-btn" :aria-label="t('layers.down')" :disabled="index === editor.canvases.value.length - 1" @click="editor.moveSection(index, 1)"><ChevronDown :size="14" aria-hidden="true" /></button>
                    </span>
                </div>
                <div v-show="!collapsed.includes(canvas.id)" class="lze-layer-children">
                    <div v-for="element in canvas.elements" :key="element.id" class="lze-layer-row" :data-selected="selectedIds.includes(element.id)">
                        <button type="button" class="lze-layer-name" @click="editor.select(canvas.id, element.id, $event.shiftKey)">
                            <ElementIcon :element="element" />
                            <span>{{ layerLabel(element) }}</span>
                        </button>
                        <button
                            type="button"
                            class="lze-icon-btn lze-lock-toggle"
                            :data-locked="element.locked === true"
                            :title="element.locked ? t('layers.unlock') : t('layers.lock')"
                            :aria-label="element.locked ? t('layers.unlock') : t('layers.lock')"
                            @click="toggleLocked(element)"
                        >
                            <Lock v-if="element.locked" :size="12" aria-hidden="true" />
                            <LockOpen v-else :size="12" aria-hidden="true" />
                        </button>
                    </div>
                    <p v-if="canvas.elements.length === 0" class="lze-hint lze-pad">{{ t('layers.empty') }}</p>
                </div>
            </div>
        </div>

        <div v-else-if="tab === 'modals'" class="lze-scroll" role="tabpanel">
            <div class="lze-heading lze-pad">
                <span class="lze-hint">{{ t('modals.hint') }}</span>
                <button type="button" class="lze-btn" data-variant="ghost" @click="editor.addModal()"><Plus :size="14" aria-hidden="true" />{{ t('common.new') }}</button>
            </div>
            <div class="lze-stack lze-pad">
                <div v-for="modal in modals" :key="modal.id" class="lze-card" :data-active="editor.state.view.kind === 'modal' && editor.state.view.id === modal.id">
                    <div class="lze-row">
                        <input v-model="modal.title" class="lze-input" maxlength="120" :aria-label="t('modals.titleLabel')" @change="editor.commit()" />
                        <button type="button" class="lze-icon-btn" data-tone="danger" :aria-label="t('modals.delete')" @click="editor.removeModal(modal.id)"><Trash2 :size="14" aria-hidden="true" /></button>
                    </div>
                    <div class="lze-heading">
                        <span class="lze-muted">{{ t('modals.elements', { n: modal.elements.length }) }}</span>
                        <button type="button" class="lze-btn" @click="editor.openModal(editor.state.view.kind === 'modal' && editor.state.view.id === modal.id ? null : modal.id)">
                            {{ editor.state.view.kind === 'modal' && editor.state.view.id === modal.id ? t('common.close') : t('modals.edit') }}
                        </button>
                    </div>
                </div>
                <p v-if="modals.length === 0" class="lze-hint">{{ t('modals.empty') }}</p>
            </div>
        </div>

        <div v-else class="lze-scroll" role="tabpanel">
            <div class="lze-heading lze-pad">
                <span class="lze-hint">{{ t('media.hint') }}</span>
                <button type="button" class="lze-btn" data-variant="ghost" @click="editor.openLibrary()"><Plus :size="14" aria-hidden="true" />{{ t('media.upload') }}</button>
            </div>
            <div class="lze-media-grid lze-pad">
                <button
                    v-for="asset in editor.state.workspace.assets"
                    :key="asset.id"
                    type="button"
                    class="lze-media-item"
                    :title="asset.name"
                    @pointerdown="startDrag($event, { kind: 'core', type: 'image' }, asset.name, asset.ref)"
                    @click="pressed($event, { kind: 'core', type: 'image' }, asset.ref)"
                    @pointermove="moveDrag"
                    @pointerup="drop"
                    @pointercancel="dragging = null"
                >
                    <img :src="asset.thumb" :alt="asset.name" loading="lazy" draggable="false" />
                </button>
                <p v-if="editor.state.workspace.assets.length === 0" class="lze-hint">{{ t('media.empty') }}</p>
            </div>
        </div>

        <p v-if="dragging?.moved" class="lze-drag-ghost" :style="{ left: `${dragging.x + 12}px`, top: `${dragging.y + 12}px` }">{{ dragging.label }}</p>
    </aside>
</template>
