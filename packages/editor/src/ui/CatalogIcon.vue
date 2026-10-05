<script setup lang="ts">
import { computed } from 'vue';
import { icons } from '../model/icons.ts';

/** An icon from Lienzo's icon catalog (the same strokes the page renders), for pickers and app elements. */
const props = withDefaults(defineProps<{ name: string; size?: number; stroke?: number }>(), { size: 18, stroke: 2 });
const nodes = computed(() => icons.get(props.name) ?? []);
</script>

<template>
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="stroke" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <component :is="node[0]" v-for="(node, index) in nodes" :key="index" v-bind="node[1]" />
    </svg>
</template>
