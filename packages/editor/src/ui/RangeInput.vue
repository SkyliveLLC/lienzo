<script setup lang="ts">
/** Slider with its label and current value; moves live, commits when released. */
const model = defineModel<number | null | undefined>({ required: true });
withDefaults(defineProps<{ label: string; min: number; max: number; step?: number; fallback?: number; format?: (value: number) => string }>(), {
    step: 1,
    fallback: 0,
    format: (value: number) => String(value),
});
const emit = defineEmits<{ commit: [] }>();
</script>

<template>
    <label class="lze-range">
        <span class="lze-label">{{ label }} <span class="lze-muted">{{ format(model ?? fallback) }}</span></span>
        <input type="range" :min="min" :max="max" :step="step" :value="model ?? fallback" @input="model = Number(($event.target as HTMLInputElement).value)" @change="emit('commit')" />
    </label>
</template>
