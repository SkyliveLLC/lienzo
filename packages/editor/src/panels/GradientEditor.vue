<script setup lang="ts">
import { computed, useId } from 'vue';
import { GRADIENT_PRESETS, gradientCss, type Gradient } from '../model/theme.ts';
import { useEditor } from '../state/editor.ts';
import ColorPicker from '../ui/ColorPicker.vue';
import Field from '../ui/Field.vue';
import RangeInput from '../ui/RangeInput.vue';
import SelectInput from '../ui/SelectInput.vue';

/** A gradient of an element fill or a section background: presets, two colors, shape and angle. */
const model = defineModel<Gradient | null | undefined>({ required: true });
const emit = defineEmits<{ commit: [] }>();
const editor = useEditor();
const t = editor.t;
const id = useId();

/** What a gradient starts as when it is first created. */
const DEFAULT: Gradient = { type: 'linear', from: 'primary', to: 'secondary', angle: 135 };
const current = computed(() => ({ ...DEFAULT, ...model.value }));

function set<K extends keyof Gradient>(key: K, value: Gradient[K]) {
    model.value = { ...current.value, [key]: value };
}

function apply(preset: Gradient) {
    model.value = { ...preset };
    emit('commit');
}
</script>

<template>
    <div class="lze-stack">
        <div class="lze-gradient-presets" role="group" :aria-label="t('gradient.presets')">
            <button
                v-for="preset in GRADIENT_PRESETS"
                :key="preset.name"
                type="button"
                class="lze-gradient-preset"
                :style="{ background: gradientCss(preset.gradient, editor.theme.value) }"
                :title="t(preset.name)"
                :aria-label="t(preset.name)"
                @click="apply(preset.gradient)"
            />
        </div>
        <ColorPicker :model-value="current.from" :label="t('gradient.from')" @update:model-value="set('from', $event)" @commit="emit('commit')" />
        <ColorPicker :model-value="current.to" :label="t('gradient.to')" @update:model-value="set('to', $event)" @commit="emit('commit')" />
        <div class="lze-grid-2">
            <Field :id="id" :label="t('gradient.shape')">
                <SelectInput
                    :id="id"
                    :model-value="current.type"
                    :options="[{ value: 'linear', label: t('gradient.linear') }, { value: 'radial', label: t('gradient.radial') }] as const"
                    @update:model-value="set('type', $event)"
                    @commit="emit('commit')"
                />
            </Field>
            <RangeInput
                v-if="current.type === 'linear'"
                :model-value="current.angle"
                :label="t('gradient.angle')"
                :min="0"
                :max="360"
                :step="5"
                :fallback="135"
                :format="(value) => `${value}°`"
                @update:model-value="set('angle', $event)"
                @commit="emit('commit')"
            />
        </div>
    </div>
</template>
