<script setup lang="ts">
import type { Element } from '@skylive/lienzo-core';
import { computed } from 'vue';
import { useEditor } from '../../state/editor.ts';
import ColorPicker from '../../ui/ColorPicker.vue';
import PanelSection from '../../ui/PanelSection.vue';
import RangeInput from '../../ui/RangeInput.vue';
import SelectInput from '../../ui/SelectInput.vue';
import GradientEditor from '../GradientEditor.vue';

const props = defineProps<{ element: Element }>();
const editor = useEditor();
const t = editor.t;
const percent = (value: number) => `${Math.round(value * 100)}%`;

/** The fill is a color or a gradient; switching to the gradient keeps the color for when it comes back. */
const mode = computed(() => (props.element.style.gradient ? 'gradient' : 'color'));

function setMode(next: 'color' | 'gradient' | null | undefined) {
    const style = props.element.style;
    style.gradient = next === 'gradient' ? (style.gradient ?? { type: 'linear', from: style.background ?? 'primary', to: 'secondary', angle: 135 }) : null;
    editor.commit();
}
</script>

<template>
    <PanelSection :title="t('style.fill')">
        <ColorPicker v-model="element.style.color" :label="t('style.color')" @commit="editor.commit()" />
        <div class="lze-heading">
            <span class="lze-label">{{ t('style.background') }}</span>
            <SelectInput
                :model-value="mode"
                compact
                :label="t('style.backgroundType')"
                :options="[{ value: 'color', label: t('fill.color') }, { value: 'gradient', label: t('fill.gradient') }] as const"
                @update:model-value="setMode"
            />
        </div>
        <ColorPicker v-if="mode === 'color'" v-model="element.style.background" :label="t('style.backgroundColor')" @commit="editor.commit()" />
        <GradientEditor v-else v-model="element.style.gradient" @commit="editor.commit()" />
        <div class="lze-grid-2">
            <RangeInput v-model="element.style.background_opacity" :label="t('style.transparency')" :min="0" :max="1" :step="0.05" :fallback="1" :format="percent" @commit="editor.commit()" />
            <RangeInput v-model="element.style.blur" :label="t('style.glass')" :min="0" :max="40" :format="(value) => `${value} px`" @commit="editor.commit()" />
        </div>
        <p v-if="element.style.blur" class="lze-hint">{{ t('style.glassHint') }}</p>
    </PanelSection>
</template>
