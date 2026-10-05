<script setup lang="ts">
/** Checkbox with its label. Toggling is a discrete edit, so it commits right away. */
const model = defineModel<boolean | null | undefined>({ required: true });
defineProps<{ label: string }>();
const emit = defineEmits<{ commit: [] }>();
</script>

<template>
    <label class="lze-toggle">
        <input type="checkbox" :checked="model === true" @change="model = ($event.target as HTMLInputElement).checked; emit('commit')" />
        <span>{{ label }}</span>
    </label>
</template>
