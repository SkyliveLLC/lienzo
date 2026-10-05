<script setup lang="ts">
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical } from '@lucide/vue';
import type { Component } from 'vue';
import { ALIGNMENTS, type Alignment } from '../model/geometry.ts';
import { useEditor } from '../state/editor.ts';
import IconButton from '../ui/IconButton.vue';

/** The six alignments: one element aligns in its canvas, several against each other. */
const editor = useEditor();

const icons: Record<Alignment, Component> = {
    left: AlignStartVertical,
    hcenter: AlignCenterVertical,
    right: AlignEndVertical,
    top: AlignStartHorizontal,
    vmiddle: AlignCenterHorizontal,
    bottom: AlignEndHorizontal,
};
</script>

<template>
    <div class="lze-row" role="group" :aria-label="editor.t('multi.align')">
        <IconButton v-for="where in ALIGNMENTS" :key="where" :label="editor.t(`align.${where}`)" @click="editor.align(where)">
            <component :is="icons[where]" :size="16" aria-hidden="true" />
        </IconButton>
    </div>
</template>
