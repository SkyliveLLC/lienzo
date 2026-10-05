<script setup lang="ts">
import { useEditor } from '../state/editor.ts';

const editor = useEditor();
</script>

<template>
    <p class="lze-hint">{{ editor.t('panel.nothing') }}</p>
</template>
