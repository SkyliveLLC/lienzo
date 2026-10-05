<script setup lang="ts" generic="T extends string | number">
/** Native select over typed options; the model keeps the option's own type. */
const model = defineModel<T | null | undefined>({ required: true });
const props = defineProps<{ options: readonly { value: T; label: string }[]; id?: string; label?: string; placeholder?: string; compact?: boolean }>();
const emit = defineEmits<{ commit: [] }>();

function change(event: Event) {
    const index = (event.target as HTMLSelectElement).selectedIndex - (props.placeholder ? 1 : 0);
    const option = props.options[index];

    if (option) {
        model.value = option.value;
        emit('commit');
    }
}
</script>

<template>
    <select :id="id" class="lze-select" :data-compact="compact" :aria-label="label" @change="change">
        <option v-if="placeholder" value="" disabled :selected="model === null || model === undefined || model === ''">{{ placeholder }}</option>
        <option v-for="option in options" :key="option.value" :selected="option.value === model">{{ option.label }}</option>
    </select>
</template>
