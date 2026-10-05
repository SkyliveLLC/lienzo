<script setup lang="ts">
import { X } from '@lucide/vue';
import { useEditor } from '../state/editor.ts';

/** Short notices in a corner; errors stay longer and are announced assertively. */
const editor = useEditor();
</script>

<template>
    <div class="lze-toasts">
        <div v-for="toast in editor.state.toasts" :key="toast.id" class="lze-toast" :data-tone="toast.tone" :role="toast.tone === 'error' ? 'alert' : 'status'">
            <span>{{ toast.text }}</span>
            <button type="button" class="lze-icon-btn" :aria-label="editor.t('toast.dismiss')" @click="editor.dismiss(toast.id)"><X :size="14" aria-hidden="true" /></button>
        </div>
    </div>
</template>
