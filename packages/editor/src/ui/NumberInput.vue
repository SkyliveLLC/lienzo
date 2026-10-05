<script setup lang="ts">
/** Compact number field: short label on the left, unit on the right. Empty means "not set". */
const model = defineModel<number | null | undefined>({ required: true });
const props = defineProps<{ label: string; min?: number; max?: number; step?: number; suffix?: string; disabled?: boolean }>();
const emit = defineEmits<{ commit: [] }>();

function input(event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const value = Number(raw);

    if (raw === '') {
        model.value = undefined;
    } else if (Number.isFinite(value)) {
        model.value = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, value));
    }
}
</script>

<template>
    <label class="lze-number">
        <span class="lze-number-label">{{ label }}</span>
        <input type="number" :value="model ?? ''" :min="min" :max="max" :step="step" :disabled="disabled" @input="input" @change="emit('commit')" />
        <span v-if="suffix" class="lze-number-suffix">{{ suffix }}</span>
    </label>
</template>
