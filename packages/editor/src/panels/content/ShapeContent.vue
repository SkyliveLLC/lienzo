<script setup lang="ts">
import type { CoreElement } from '@skylive/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import RangeInput from '../../ui/RangeInput.vue';
import SelectInput from '../../ui/SelectInput.vue';
import { shapeOptions } from './shapes.ts';

defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const id = useId();
</script>

<template>
    <Field :id="id" :label="t('el.shape')">
        <SelectInput :id="id" v-model="element.props.shape" :options="shapeOptions(t)" @commit="editor.commit()" />
    </Field>
    <RangeInput
        v-model="element.style.opacity"
        :label="t('el.opacity')"
        :min="0.1"
        :max="1"
        :step="0.05"
        :fallback="1"
        :format="(value) => `${Math.round(value * 100)}%`"
        @commit="editor.commit()"
    />
</template>
