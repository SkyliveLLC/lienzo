<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import NumberInput from '../../ui/NumberInput.vue';
import SelectInput from '../../ui/SelectInput.vue';
import TextInput from '../../ui/TextInput.vue';
import PictureList from './PictureList.vue';

/** A gallery is a list of pictures, laid out as a grid or as a strip. */
const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { layout: useId(), alt: useId() };
const layouts = (['grid', 'strip'] as const).map((value) => ({ value, label: t(`el.gallery.${value}`) }));
</script>

<template>
    <Field :id="ids.layout" :label="t('el.galleryLayout')">
        <SelectInput :id="ids.layout" :model-value="element.props.layout ?? 'grid'" :options="layouts" @update:model-value="element.props.layout = $event" @commit="editor.commit()" />
    </Field>
    <NumberInput
        v-if="(element.props.layout ?? 'grid') === 'grid'"
        :model-value="element.props.columns ?? 3"
        :label="t('el.galleryColumns')"
        :min="1"
        :max="6"
        @update:model-value="element.props.columns = $event ?? 3"
        @commit="editor.commit()"
    />
    <PictureList :element="element" />
    <Field :id="ids.alt" :label="t('el.alt')">
        <TextInput :id="ids.alt" v-model="element.props.alt" :maxlength="200" :placeholder="t('el.altPlaceholder')" @commit="editor.commit()" />
    </Field>
</template>
