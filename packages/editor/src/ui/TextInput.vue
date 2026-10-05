<script setup lang="ts">
/**
 * Single or multi-line text. `commit` fires on change (blur or Enter), which
 * is when callers record an undo step; the model updates on every keystroke.
 */
const model = defineModel<string | null | undefined>({ required: true });
withDefaults(defineProps<{ id?: string; placeholder?: string; maxlength?: number; rows?: number; label?: string; type?: string }>(), {
    id: undefined,
    placeholder: undefined,
    maxlength: undefined,
    rows: 0,
    label: undefined,
    type: 'text',
});
const emit = defineEmits<{ commit: [] }>();
</script>

<template>
    <textarea v-if="rows > 0" :id="id" v-model="model" class="lze-input" :rows="rows" :maxlength="maxlength" :placeholder="placeholder" :aria-label="label" @change="emit('commit')" />
    <input v-else :id="id" v-model="model" class="lze-input" :type="type" :maxlength="maxlength" :placeholder="placeholder" :aria-label="label" @change="emit('commit')" />
</template>
