<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { computed } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Button from '../../ui/Button.vue';
import ImageField from '../../ui/ImageField.vue';

const MAX_PICTURES = 24;

/** The pictures of a gallery or a slider: one field per slot, in the order shown. */
const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
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
</template>
