<script setup lang="ts">
import type { Element, Style } from '@skylive/lienzo-core';
import { computed, useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import ColorPicker from '../../ui/ColorPicker.vue';
import Field from '../../ui/Field.vue';
import NumberInput from '../../ui/NumberInput.vue';
import PanelSection from '../../ui/PanelSection.vue';
import RangeInput from '../../ui/RangeInput.vue';
import SelectInput from '../../ui/SelectInput.vue';

type Shadow = NonNullable<Style['shadow_custom']>;

const props = defineProps<{ element: Element }>();
const editor = useEditor();
const t = editor.t;
const id = useId();

const shadows = (['none', 'sm', 'md', 'lg', 'custom'] as const).map((shadow) => ({ value: shadow, label: t(`style.shadow.${shadow}`) }));

/** What a custom shadow starts as the first time it is edited. */
const DEFAULT_SHADOW: Shadow = { x: 0, y: 12, blur: 32, spread: 0, color: 'secondary', opacity: 0.2 };
const shadow = computed(() => ({ ...DEFAULT_SHADOW, ...props.element.style.shadow_custom }));

function setShadow<K extends keyof Shadow>(key: K, value: Shadow[K]) {
    props.element.style.shadow_custom = { ...shadow.value, [key]: value };
}
</script>

<template>
    <PanelSection :title="t('style.frame')">
        <div class="lze-grid-2">
            <NumberInput v-model="element.style.radius" :label="t('style.radius')" :min="0" :max="999" suffix="px" @commit="editor.commit()" />
            <NumberInput v-model="element.style.padding" :label="t('style.padding')" :min="0" :max="80" suffix="px" @commit="editor.commit()" />
            <NumberInput v-model="element.style.border_width" :label="t('style.border')" :min="0" :max="12" suffix="px" @commit="editor.commit()" />
            <NumberInput
                :model-value="element.z"
                :label="t('style.layer')"
                :min="0"
                :max="999"
                @update:model-value="element.z = $event ?? element.z"
                @commit="editor.commit()"
            />
        </div>
        <ColorPicker v-if="element.style.border_width" v-model="element.style.border_color" :label="t('style.borderColor')" @commit="editor.commit()" />
        <Field :id="id" :label="t('style.shadow')">
            <SelectInput :id="id" :model-value="element.style.shadow ?? 'none'" :options="shadows" @update:model-value="element.style.shadow = $event" @commit="editor.commit()" />
        </Field>
    </PanelSection>
    <PanelSection v-if="element.style.shadow === 'custom'" :title="t('style.customShadow')">
        <div class="lze-grid-2">
            <NumberInput :model-value="shadow.x" :label="t('position.x')" :min="-100" :max="100" suffix="px" @update:model-value="setShadow('x', $event)" @commit="editor.commit()" />
            <NumberInput :model-value="shadow.y" :label="t('position.y')" :min="-100" :max="100" suffix="px" @update:model-value="setShadow('y', $event)" @commit="editor.commit()" />
            <NumberInput :model-value="shadow.blur" :label="t('style.shadowBlur')" :min="0" :max="200" suffix="px" @update:model-value="setShadow('blur', $event)" @commit="editor.commit()" />
            <NumberInput :model-value="shadow.spread" :label="t('style.shadowSpread')" :min="-50" :max="100" suffix="px" @update:model-value="setShadow('spread', $event)" @commit="editor.commit()" />
        </div>
        <ColorPicker :model-value="shadow.color" :label="t('style.shadowColor')" @update:model-value="setShadow('color', $event)" @commit="editor.commit()" />
        <RangeInput
            :model-value="shadow.opacity"
            :label="t('style.shadowOpacity')"
            :min="0"
            :max="1"
            :step="0.05"
            :format="(value) => `${Math.round(value * 100)}%`"
            @update:model-value="setShadow('opacity', $event)"
            @commit="editor.commit()"
        />
    </PanelSection>
</template>
