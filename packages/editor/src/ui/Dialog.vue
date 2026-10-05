<script setup lang="ts">
import { X } from '@lucide/vue';
import { onMounted, ref, useId, watch } from 'vue';
import { useEditor } from '../state/editor.ts';

/**
 * A modal dialog on the native `<dialog>`: focus trap, Escape and the top
 * layer for free, and it stays inside the editor's shadow root when there is one.
 */
const open = defineModel<boolean>('open', { required: true });
withDefaults(defineProps<{ title: string; description?: string; size?: 'md' | 'lg' | 'xl' }>(), { description: undefined, size: 'md' });
const dialog = ref<HTMLDialogElement>();
const heading = useId();
const { t } = useEditor();

function sync() {
    if (open.value && !dialog.value?.open) {
        dialog.value?.showModal();
    } else if (!open.value && dialog.value?.open) {
        dialog.value.close();
    }
}

watch(open, sync);

/** A click closes on the backdrop only if it also started there, not when a text selection ends outside. */
let downOnBackdrop = false;
const pressed = (event: PointerEvent) => (downOnBackdrop = event.target === event.currentTarget);
const clicked = (event: MouseEvent) => {
    if (downOnBackdrop && event.target === event.currentTarget) {
        open.value = false;
    }
};
onMounted(sync);
</script>

<template>
    <dialog ref="dialog" class="lze-dialog" :data-size="size" :aria-labelledby="heading" @close="open = false" @pointerdown="pressed" @click="clicked">
        <div class="lze-dialog-body">
            <header class="lze-dialog-head">
                <div>
                    <h2 :id="heading">{{ title }}</h2>
                    <p v-if="description" class="lze-hint">{{ description }}</p>
                </div>
                <button type="button" class="lze-icon-btn" :aria-label="t('common.close')" @click="open = false"><X :size="16" aria-hidden="true" /></button>
            </header>
            <slot v-if="open" />
        </div>
    </dialog>
</template>
