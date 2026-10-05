<script setup lang="ts">
import { AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from '@lucide/vue';
import { computed } from 'vue';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import IconButton from '../ui/IconButton.vue';
import AlignButtons from './AlignButtons.vue';

/** Settings of several selected elements at once. */
const editor = useEditor();
const t = editor.t;
const count = computed(() => editor.selectedElements.value.length);
</script>

<template>
    <div class="lze-stack">
        <h2 class="lze-panel-title">{{ t('multi.count', { n: count }) }}</h2>
        <div class="lze-field">
            <span class="lze-label">{{ t('multi.align') }}</span>
            <AlignButtons />
        </div>
        <div class="lze-field">
            <span class="lze-label">{{ t('multi.distribute') }}</span>
            <div class="lze-row">
                <IconButton :label="t('multi.distributeX')" :disabled="count < 3" @click="editor.distributeSelected('x')">
                    <AlignHorizontalDistributeCenter :size="16" aria-hidden="true" />
                </IconButton>
                <IconButton :label="t('multi.distributeY')" :disabled="count < 3" @click="editor.distributeSelected('y')">
                    <AlignVerticalDistributeCenter :size="16" aria-hidden="true" />
                </IconButton>
            </div>
            <p class="lze-hint">{{ t('multi.distributeHint') }}</p>
        </div>
        <div class="lze-row">
            <Button @click="editor.groupSelected()">{{ t('multi.group') }}</Button>
            <Button @click="editor.ungroupSelected()">{{ t('multi.ungroup') }}</Button>
            <Button @click="editor.toggleLock()">{{ t('multi.lock') }}</Button>
            <Button @click="editor.duplicateSelected()">{{ t('common.duplicate') }}</Button>
            <Button variant="danger" @click="editor.removeSelected()">{{ t('common.delete') }}</Button>
        </div>
        <p class="lze-hint">{{ t('multi.hint') }}</p>
    </div>
</template>
