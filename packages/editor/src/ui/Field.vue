<script setup lang="ts">
/** A labelled control with an optional hint and error. Put the control in the default slot with `:id="id"`. */
defineProps<{ label: string; id?: string; hint?: string; error?: string | null }>();
</script>

<template>
    <div class="lze-field">
        <label v-if="id" class="lze-label" :for="id">{{ label }}<slot name="aside" /></label>
        <span v-else class="lze-label">{{ label }}<slot name="aside" /></span>
        <slot />
        <p v-if="error" class="lze-error" role="alert">{{ error }}</p>
        <p v-else-if="hint" class="lze-hint">{{ hint }}</p>
    </div>
</template>
