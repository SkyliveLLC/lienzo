<script setup lang="ts">
import type { CoreElementType, Element, StyleGroup } from '@skylivellc/lienzo-core';
import { computed, type Component } from 'vue';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import AppContent from './content/AppContent.vue';
import ButtonContent from './content/ButtonContent.vue';
import FormFieldContent from './content/FormFieldContent.vue';
import IconContent from './content/IconContent.vue';
import ImageContent from './content/ImageContent.vue';
import NavbarContent from './content/NavbarContent.vue';
import ShapeContent from './content/ShapeContent.vue';
import TextContent from './content/TextContent.vue';
import VideoContent from './content/VideoContent.vue';
import FillStyle from './style/FillStyle.vue';
import FrameStyle from './style/FrameStyle.vue';
import MotionStyle from './style/MotionStyle.vue';
import PositionSection from './style/PositionSection.vue';
import TextStyle from './style/TextStyle.vue';
import TransformStyle from './style/TransformStyle.vue';

/** Settings of the one selected element: its content, its look, and where it sits. */
const props = defineProps<{ element: Element }>();
const editor = useEditor();
const t = editor.t;

/** Content controls per core type. A divider has none. */
const coreContent = {
    heading: TextContent,
    text: TextContent,
    image: ImageContent,
    button: ButtonContent,
    divider: null,
    video: VideoContent,
    shape: ShapeContent,
    icon: IconContent,
    navbar: NavbarContent,
    input: FormFieldContent,
    textarea: FormFieldContent,
    select: FormFieldContent,
    checkbox: FormFieldContent,
} satisfies Record<CoreElementType, Component | null>;

/** Style panels, in the order they are shown. An element shows the ones its type declares. */
const stylePanels = {
    fill: FillStyle,
    text: TextStyle,
    border: FrameStyle,
    effects: TransformStyle,
    motion: MotionStyle,
} satisfies Record<StyleGroup, Component>;

const kind = computed(() => editor.kindOf(props.element));

const title = computed(() => {
    const current = kind.value;

    return current.kind === 'core' ? t(current.spec.label) : current.kind === 'app' ? editor.i18n.localized(current.spec.label) : t('type.unknown');
});

const styles = computed(() => {
    const current = kind.value;
    const declared: readonly StyleGroup[] = current.kind === 'opaque' ? [] : current.spec.styles;

    return (Object.keys(stylePanels) as StyleGroup[]).filter((group) => declared.includes(group)).map((group) => ({ group, panel: stylePanels[group] }));
});
</script>

<template>
    <div class="lze-stack">
        <div class="lze-heading">
            <h2 class="lze-panel-title">{{ title }}</h2>
            <div class="lze-row lze-nowrap">
                <Button v-if="kind.kind !== 'opaque'" @click="editor.duplicateSelected()">{{ t('common.duplicate') }}</Button>
                <Button variant="danger" @click="editor.removeSelected()">{{ t('common.delete') }}</Button>
            </div>
        </div>
        <p v-if="kind.kind === 'opaque'" class="lze-hint">{{ t('el.unknown') }}</p>
        <template v-else>
            <component :is="coreContent[kind.element.type]" v-if="kind.kind === 'core' && coreContent[kind.element.type]" :element="kind.element" />
            <AppContent v-else-if="kind.kind === 'app'" :element="kind.element" :spec="kind.spec" />
            <component :is="style.panel" v-for="style in styles" :key="style.group" :element="element" />
            <PositionSection :element="element" />
        </template>
    </div>
</template>
