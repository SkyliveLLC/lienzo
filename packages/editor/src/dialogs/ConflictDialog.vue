<script setup lang="ts">
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import Dialog from '../ui/Dialog.vue';

/** Someone saved this page elsewhere: the only way on is to reload it. */
const editor = useEditor();
const open = editor.dialogModel('conflict');
</script>

<template>
    <Dialog v-model:open="open" :title="editor.t('conflict.title')" :description="editor.t('conflict.body')">
        <div class="lze-dialog-actions">
            <Button variant="primary" size="md" @click="editor.reloadPage()">{{ editor.t('conflict.reload') }}</Button>
            <Button size="md" @click="open = false">{{ editor.t('common.close') }}</Button>
        </div>
    </Dialog>
</template>
