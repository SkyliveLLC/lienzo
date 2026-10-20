<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { computed, useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Button from '../../ui/Button.vue';
import Field from '../../ui/Field.vue';
import ImageField from '../../ui/ImageField.vue';
import NumberInput from '../../ui/NumberInput.vue';
import SelectInput from '../../ui/SelectInput.vue';
import TextInput from '../../ui/TextInput.vue';

const MAX_PICTURES = 24;

/** A gallery is a list of pictures: one field per slot, in the order shown. */
const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { layout: useId(), alt: useId() };
const layouts = (['grid', 'strip'] as const).map((value) => ({ value, label: t(`el.gallery.${value}`) }));
const pictures = computed(() => props.element.props.images ?? []);

function set(index: number, source: string | null | undefined) {
    props.element.props.images = pictures.value.map((picture, at) => (at === index ? source ?? '' : picture));
}

function add() {
    props.element.props.images = [...pictures.value, ''];
    editor.commit();
}

function remove(index: number) {
    props.element.props.images = pictures.value.filter((_, at) => at !== index);
    editor.commit();
}
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
    <div class="lze-field">
        <div class="lze-heading">
            <span class="lze-label">{{ t('el.gallery') }}</span>
            <Button :disabled="pictures.length >= MAX_PICTURES" @click="add">{{ t('el.galleryAdd') }}</Button>
        </div>
        <div v-for="(picture, index) in pictures" :key="index" class="lze-row lze-nowrap">
            <ImageField
                :model-value="picture"
                :label="t('el.galleryItem', { n: index + 1 })"
                url
                class="lze-grow"
                @update:model-value="set(index, $event)"
                @commit="editor.commit()"
            />
            <Button variant="danger" @click="remove(index)">{{ t('el.galleryRemove') }}</Button>
        </div>
        <p class="lze-hint">{{ t('el.galleryHint') }}</p>
    </div>
    <Field :id="ids.alt" :label="t('el.alt')">
        <TextInput :id="ids.alt" v-model="element.props.alt" :maxlength="200" :placeholder="t('el.altPlaceholder')" @commit="editor.commit()" />
    </Field>
</template>
