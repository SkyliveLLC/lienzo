<script setup lang="ts">
import type { AppElement, ElementSpec, FieldValue } from '@skylivellc/lienzo-core';
import { useEditor } from '../../state/editor.ts';
import FieldControl from '../FieldControl.vue';

/** An app element's content, one control per field it declares. */
const props = defineProps<{ element: AppElement; spec: ElementSpec }>();
const editor = useEditor();

function set(key: string, value: FieldValue) {
    props.element.props = { ...props.element.props, [key]: value };
}
</script>

<template>
    <FieldControl
        v-for="field in spec.fields"
        :key="field.key"
        :field="field"
        :model-value="element.props[field.key]"
        @update:model-value="set(field.key, $event)"
        @commit="editor.commit()"
    />
</template>
