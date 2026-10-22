<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { computed } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Button from '../../ui/Button.vue';
import TextInput from '../../ui/TextInput.vue';

const MAX_ITEMS = 20;

/** Each fold is a question and its answer, in the order they are read. */
const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const items = computed(() => props.element.props.items ?? []);

function set(index: number, key: 'title' | 'text', value: string) {
    props.element.props.items = items.value.map((item, at) => (at === index ? { ...item, [key]: value } : item));
}

function add() {
    props.element.props.items = [...items.value, { title: t('el.foldTitleNew'), text: '' }];
    editor.commit();
}

function remove(index: number) {
    props.element.props.items = items.value.filter((_, at) => at !== index);
    editor.commit();
}
</script>

<template>
    <div class="lze-field">
        <div class="lze-heading">
            <span class="lze-label">{{ t('el.folds') }}</span>
            <Button :disabled="items.length >= MAX_ITEMS" @click="add">{{ t('el.foldAdd') }}</Button>
        </div>
        <div v-for="(item, index) in items" :key="index" class="lze-card">
            <TextInput
                :model-value="item.title"
                :label="t('el.foldTitle', { n: index + 1 })"
                :maxlength="160"
                @update:model-value="set(index, 'title', $event ?? '')"
                @commit="editor.commit()"
            />
            <TextInput
                :model-value="item.text ?? ''"
                :label="t('el.foldText')"
                :maxlength="2000"
                :rows="3"
                @update:model-value="set(index, 'text', $event ?? '')"
                @commit="editor.commit()"
            />
            <Button variant="danger" @click="remove(index)">{{ t('common.remove') }}</Button>
        </div>
        <p v-if="items.length === 0" class="lze-hint">{{ t('el.foldsEmpty') }}</p>
    </div>
</template>
