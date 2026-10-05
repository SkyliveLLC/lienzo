<script setup lang="ts">
import type { Box, Element } from '@skylive/lienzo-core';
import { computed } from 'vue';
import { boxOf, writeBox } from '../../model/document.ts';
import { clampBox } from '../../model/geometry.ts';
import { useEditor } from '../../state/editor.ts';
import NumberInput from '../../ui/NumberInput.vue';
import PanelSection from '../../ui/PanelSection.vue';
import AlignButtons from '../AlignButtons.vue';

/** Where the element sits on the device being edited. On a phone it may follow the desktop box. */
const props = defineProps<{ element: Element }>();
const editor = useEditor();
const t = editor.t;
const device = computed(() => editor.state.device);
const box = computed(() => boxOf(props.element, device.value));

function set(key: keyof Box, value: number | null | undefined) {
    if (typeof value === 'number') {
        writeBox(props.element, device.value, clampBox({ ...box.value, [key]: value }));
    }
}

function inherit() {
    props.element.layout.mobile = null;
    editor.commit();
}
</script>

<template>
    <PanelSection :title="t('position.title', { device: t(device === 'desktop' ? 'position.desktop' : 'position.mobile') })" :open="false">
        <AlignButtons />
        <div class="lze-grid-2">
            <NumberInput :model-value="box.x" :label="t('position.x')" suffix="%" :step="0.5" @update:model-value="set('x', $event)" @commit="editor.commit()" />
            <NumberInput :model-value="box.y" :label="t('position.y')" @update:model-value="set('y', $event)" @commit="editor.commit()" />
            <NumberInput :model-value="box.w" :label="t('position.width')" suffix="%" :step="0.5" @update:model-value="set('w', $event)" @commit="editor.commit()" />
            <NumberInput :model-value="box.h" :label="t('position.height')" @update:model-value="set('h', $event)" @commit="editor.commit()" />
        </div>
        <p v-if="device === 'mobile'" class="lze-hint">
            <template v-if="element.layout.mobile">
                {{ t('position.own') }}
                <button type="button" class="lze-link" @click="inherit">{{ t('position.inherit') }}</button>
            </template>
            <template v-else>{{ t('position.inherited') }}</template>
        </p>
    </PanelSection>
</template>
