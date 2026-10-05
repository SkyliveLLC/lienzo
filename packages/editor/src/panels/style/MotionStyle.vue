<script setup lang="ts">
import type { Element, Style } from '@skylivellc/lienzo-core';
import { computed, useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import PanelSection from '../../ui/PanelSection.vue';
import RangeInput from '../../ui/RangeInput.vue';
import SelectInput from '../../ui/SelectInput.vue';

type Animation = NonNullable<Style['animation']>;

const props = defineProps<{ element: Element }>();
const editor = useEditor();
const t = editor.t;
const ids = { entrance: useId(), hover: useId() };

const entrances = (['none', 'fade', 'up', 'down', 'left', 'right', 'zoom'] as const).map((value) => ({ value, label: t(`style.anim.${value}`) }));
const hovers = (['none', 'lift', 'grow', 'fade'] as const).map((value) => ({ value, label: t(`style.hover.${value}`) }));
const seconds = (value: number) => `${value} s`;

/** What the entrance starts as the first time it is edited. */
const DEFAULT_ANIMATION: Animation = { type: 'none', delay: 0, duration: 0.7 };
const animation = computed(() => ({ ...DEFAULT_ANIMATION, ...props.element.style.animation }));

function setAnimation<K extends keyof Animation>(key: K, value: Animation[K]) {
    props.element.style.animation = { ...animation.value, [key]: value };
}
</script>

<template>
    <PanelSection :title="t('style.motion')" :open="false">
        <Field :id="ids.entrance" :label="t('style.entrance')">
            <SelectInput :id="ids.entrance" :model-value="animation.type" :options="entrances" @update:model-value="setAnimation('type', $event)" @commit="editor.commit()" />
        </Field>
        <div v-if="animation.type !== 'none'" class="lze-grid-2">
            <RangeInput :model-value="animation.delay" :label="t('style.delay')" :min="0" :max="2" :step="0.1" :format="seconds" @update:model-value="setAnimation('delay', $event)" @commit="editor.commit()" />
            <RangeInput
                :model-value="animation.duration"
                :label="t('style.duration')"
                :min="0.2"
                :max="2"
                :step="0.1"
                :fallback="0.7"
                :format="seconds"
                @update:model-value="setAnimation('duration', $event)"
                @commit="editor.commit()"
            />
        </div>
        <Field :id="ids.hover" :label="t('style.hover')">
            <SelectInput :id="ids.hover" :model-value="element.style.hover ?? 'none'" :options="hovers" @update:model-value="element.style.hover = $event" @commit="editor.commit()" />
        </Field>
        <p class="lze-hint">{{ t('style.motionHint') }}</p>
    </PanelSection>
</template>
