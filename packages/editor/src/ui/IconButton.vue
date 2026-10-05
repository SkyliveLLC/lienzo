<script setup lang="ts">
/** Square icon button with a tooltip; `active` shows a pressed state, like design tools. */
withDefaults(defineProps<{ label: string; active?: boolean; disabled?: boolean; tone?: 'default' | 'danger' }>(), { active: undefined, disabled: false, tone: 'default' });
</script>

<template>
    <button type="button" class="lze-icon-btn" :data-tone="tone" :title="label" :aria-label="label" :aria-pressed="active" :disabled="disabled"><slot /></button>
</template>
