<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import NumberInput from '../../ui/NumberInput.vue';
import TextInput from '../../ui/TextInput.vue';
import Toggle from '../../ui/Toggle.vue';
import PictureList from './PictureList.vue';

/** A slider shows one picture at a time, and says how a reader moves it. */
defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { alt: useId() };
</script>

<template>
    <PictureList :element="element" />
    <Toggle :model-value="element.props.arrows !== false" :label="t('el.sliderArrows')" @update:model-value="element.props.arrows = $event; editor.commit()" />
    <Toggle :model-value="element.props.dots !== false" :label="t('el.sliderDots')" @update:model-value="element.props.dots = $event; editor.commit()" />
    <Toggle :model-value="element.props.autoplay === true" :label="t('el.sliderAutoplay')" @update:model-value="element.props.autoplay = $event; editor.commit()" />
    <NumberInput
        v-if="element.props.autoplay === true"
        :model-value="element.props.interval ?? 5"
        :label="t('el.sliderInterval')"
        :min="2"
        :max="12"
        @update:model-value="element.props.interval = $event ?? 5"
        @commit="editor.commit()"
    />
    <Field :id="ids.alt" :label="t('el.alt')">
        <TextInput :id="ids.alt" v-model="element.props.alt" :maxlength="200" :placeholder="t('el.altPlaceholder')" @commit="editor.commit()" />
    </Field>
</template>
