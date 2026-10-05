<script setup lang="ts">
import { ChevronDown } from '@lucide/vue';

/** Collapsible block of the settings panel; the title stays visible when closed. */
withDefaults(defineProps<{ title: string; open?: boolean }>(), { open: true });
</script>

<template>
    <details class="lze-panel-section" :open="open">
        <summary>{{ title }}<ChevronDown :size="14" aria-hidden="true" /></summary>
        <div class="lze-panel-body"><slot /></div>
    </details>
</template>
