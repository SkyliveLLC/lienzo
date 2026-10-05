<script setup lang="ts">
import { computed } from 'vue';
import { findCanvas, isModal } from '../model/document.ts';
import { useEditor } from '../state/editor.ts';
import ElementPanel from './ElementPanel.vue';
import ModalPanel from './ModalPanel.vue';
import MultiPanel from './MultiPanel.vue';
import SectionPanel from './SectionPanel.vue';

/** The Design tab: settings of whatever is selected. */
const editor = useEditor();

const shown = computed(() => {
    const selection = editor.state.selection;

    if (selection.kind === 'elements') {
        const element = editor.activeElement.value;

        return editor.selectedElements.value.length > 1 ? { kind: 'multi' as const } : element ? { kind: 'element' as const, element } : { kind: 'none' as const };
    }

    const canvas = selection.kind === 'canvas' ? findCanvas(editor.state.draft, selection.canvas) : undefined;

    if (!canvas) {
        return { kind: 'none' as const };
    }

    return isModal(canvas) ? { kind: 'modal' as const, modal: canvas } : { kind: 'section' as const, section: canvas };
});
</script>

<template>
    <MultiPanel v-if="shown.kind === 'multi'" />
    <ElementPanel v-else-if="shown.kind === 'element'" :key="shown.element.id" :element="shown.element" />
    <ModalPanel v-else-if="shown.kind === 'modal'" :key="shown.modal.id" :modal="shown.modal" />
    <SectionPanel v-else-if="shown.kind === 'section'" :key="shown.section.id" :section="shown.section" />
    <p v-else class="lze-hint">{{ editor.t('panel.nothing') }}</p>
</template>
