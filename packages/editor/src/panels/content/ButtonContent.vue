<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import TextInput from '../../ui/TextInput.vue';
import ActionPicker from '../ActionPicker.vue';

defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const id = useId();
</script>

<template>
    <Field :id="id" :label="t('el.buttonLabel')">
        <TextInput :id="id" v-model="element.props.label" :maxlength="80" @commit="editor.commit()" />
    </Field>
    <Field :label="t('el.action')">
        <ActionPicker v-model="element.props.action" :label="t('el.action')" @commit="editor.commit()" />
    </Field>
</template>
