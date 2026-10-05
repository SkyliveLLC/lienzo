<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { computed, ref, useId } from 'vue';
import { ICON_NAMES } from '../../model/icons.ts';
import { useEditor } from '../../state/editor.ts';
import CatalogIcon from '../../ui/CatalogIcon.vue';
import Field from '../../ui/Field.vue';
import RangeInput from '../../ui/RangeInput.vue';
import TextInput from '../../ui/TextInput.vue';

const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const id = useId();
const search = ref('');

const matches = computed(() => {
    const term = search.value.trim().toLowerCase();

    return term ? ICON_NAMES.filter((name) => name.includes(term)) : ICON_NAMES;
});

function pick(name: string) {
    props.element.props.icon = name;
    editor.commit();
}
</script>

<template>
    <Field :id="id" :label="t('el.icon')">
        <TextInput :id="id" v-model="search" type="search" :placeholder="t('el.iconSearch')" />
        <div class="lze-icon-grid" role="group" :aria-label="t('el.iconOptions')">
            <button
                v-for="name in matches"
                :key="name"
                type="button"
                class="lze-icon-choice"
                :title="name"
                :aria-label="name"
                :aria-pressed="element.props.icon === name"
                @click="pick(name)"
            >
                <CatalogIcon :name="name" :size="20" />
            </button>
            <p v-if="matches.length === 0" class="lze-hint">{{ t('el.noResults') }}</p>
        </div>
    </Field>
    <RangeInput v-model="element.props.stroke" :label="t('el.stroke')" :min="0.5" :max="4" :step="0.25" :fallback="2" @commit="editor.commit()" />
</template>
