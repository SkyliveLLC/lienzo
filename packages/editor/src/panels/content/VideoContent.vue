<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import TextInput from '../../ui/TextInput.vue';

defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const id = useId();
</script>

<template>
    <Field :id="id" :label="t('el.videoUrl')" :hint="t('el.videoHint')">
        <TextInput :id="id" v-model="element.props.url" type="url" :maxlength="500" :placeholder="t('el.videoPlaceholder')" @commit="editor.commit()" />
    </Field>
</template>
