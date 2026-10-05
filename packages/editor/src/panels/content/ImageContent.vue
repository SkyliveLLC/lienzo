<script setup lang="ts">
import type { CoreElement } from '@skylive/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import ImageField from '../../ui/ImageField.vue';
import SelectInput from '../../ui/SelectInput.vue';
import TextInput from '../../ui/TextInput.vue';
import { shapeOptions } from './shapes.ts';

defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { alt: useId(), fit: useId(), crop: useId() };
const fits = (['cover', 'contain'] as const).map((value) => ({ value, label: t(`el.fit.${value}`) }));
</script>

<template>
    <ImageField v-model="element.props.src" :label="t('el.image')" url @commit="editor.commit()" />
    <Field :id="ids.alt" :label="t('el.alt')">
        <TextInput :id="ids.alt" v-model="element.props.alt" :maxlength="200" :placeholder="t('el.altPlaceholder')" @commit="editor.commit()" />
    </Field>
    <Field :id="ids.fit" :label="t('el.fit')">
        <SelectInput :id="ids.fit" v-model="element.style.object_fit" :options="fits" @commit="editor.commit()" />
    </Field>
    <Field :id="ids.crop" :label="t('el.crop')">
        <SelectInput :id="ids.crop" v-model="element.props.shape" :options="shapeOptions(t)" @commit="editor.commit()" />
    </Field>
</template>
