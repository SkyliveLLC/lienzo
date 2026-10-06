<script setup lang="ts">
import type { StyleGroup } from '@skylivellc/lienzo-core';
import { AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from '@lucide/vue';
import { computed, type Component } from 'vue';
import { useEditor } from '../state/editor.ts';
import IconButton from '../ui/IconButton.vue';
import AlignButtons from './AlignButtons.vue';
import FillStyle from './style/FillStyle.vue';
import FrameStyle from './style/FrameStyle.vue';
import MotionStyle from './style/MotionStyle.vue';
import TextStyle from './style/TextStyle.vue';
import TransformStyle from './style/TransformStyle.vue';

/**
 * Settings of several selected elements at once. Only what is visual lives
 * here; grouping, locking, order, duplicating and deleting are in the menu a
 * right click opens on the canvas.
 */
const editor = useEditor();
const t = editor.t;
const count = computed(() => editor.selectedElements.value.length);

const stylePanels = {
    fill: FillStyle,
    text: TextStyle,
    border: FrameStyle,
    effects: TransformStyle,
    motion: MotionStyle,
} satisfies Record<StyleGroup, Component>;

/** What every selected element understands: changing it changes all of them. */
const shared = computed(() => {
    const groups = editor.selectedElements.value.map((element) => {
        const kind = editor.kindOf(element);

        return kind.kind === 'opaque' ? [] : kind.spec.styles;
    });

    return (Object.keys(stylePanels) as StyleGroup[])
        .filter((group) => groups.length > 0 && groups.every((declared) => declared.includes(group)))
        .map((group) => ({ group, panel: stylePanels[group] }));
});

/** One object that writes to the whole selection. */
const target = computed(() => editor.sharedTarget());
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
        <template v-if="target">
            <component :is="style.panel" v-for="style in shared" :key="style.group" :element="target" />
        </template>
        <p class="lze-hint">{{ t('multi.menuHint') }}</p>
        <p class="lze-hint">{{ t('multi.hint') }}</p>
    </div>
</template>
