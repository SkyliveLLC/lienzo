<script setup lang="ts">
/** Text button of the editor chrome. `primary` is the one main action of a place. */
withDefaults(defineProps<{ variant?: 'primary' | 'outline' | 'ghost' | 'danger'; size?: 'sm' | 'md'; disabled?: boolean; title?: string }>(), {
    variant: 'outline',
    size: 'sm',
    disabled: false,
    title: undefined,
});
</script>

<template>
    <button type="button" class="lze-btn" :data-variant="variant" :data-size="size" :disabled="disabled" :title="title"><slot /></button>
</template>
