<script setup lang="ts">
import { X } from '@lucide/vue';
import { onMounted, ref, watch } from 'vue';

/**
 * A modal dialog on the native `<dialog>`: focus trap, Escape and the top
 * layer for free, and it stays inside the editor's shadow root when there is one.
 */
const open = defineModel<boolean>('open', { required: true });
withDefaults(defineProps<{ title: string; description?: string; size?: 'md' | 'lg' | 'xl' }>(), { description: undefined, size: 'md' });
const dialog = ref<HTMLDialogElement>();

function sync() {
    if (open.value && !dialog.value?.open) {
        dialog.value?.showModal();
    } else if (!open.value && dialog.value?.open) {
        dialog.value.close();
    }
}

watch(open, sync);
onMounted(sync);
</script>

<template>
    <dialog ref="dialog" class="lze-dialog" :data-size="size" @close="open = false" @click.self="open = false">
        <div class="lze-dialog-body">
            <header class="lze-dialog-head">
                <div>
                    <h2>{{ title }}</h2>
                    <p v-if="description" class="lze-hint">{{ description }}</p>
                </div>
                <button type="button" class="lze-icon-btn" :aria-label="'×'" @click="open = false"><X :size="16" aria-hidden="true" /></button>
            </header>
            <slot v-if="open" />
        </div>
    </dialog>
</template>
