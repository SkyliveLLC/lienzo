<script setup lang="ts">
import type { Element } from '@skylive/lienzo-core';
import { CircleHelp } from '@lucide/vue';
import { computed } from 'vue';
import { useEditor } from '../state/editor.ts';
import CatalogIcon from '../ui/CatalogIcon.vue';
import { typeIcons } from './typeIcons.ts';

/** The icon of an element's type: lucide for core types, the catalog icon the app chose for its own. */
const props = withDefaults(defineProps<{ element: Element; size?: number }>(), { size: 14 });
const editor = useEditor();
const kind = computed(() => editor.kindOf(props.element));
</script>

<template>
    <component :is="typeIcons[kind.element.type]" v-if="kind.kind === 'core'" :size="size" aria-hidden="true" />
    <CatalogIcon v-else-if="kind.kind === 'app'" :name="kind.spec.icon" :size="size" />
    <CircleHelp v-else :size="size" aria-hidden="true" />
</template>
