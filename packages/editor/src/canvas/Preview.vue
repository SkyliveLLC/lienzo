<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { clamp } from '../model/geometry.ts';
import { useEditor } from '../state/editor.ts';
import { renderDraft } from './render.ts';

/**
 * The page as visitors get it: the complete public document from core,
 * runtime included (tabs, modals, sticky navbar, animations), in an iframe at
 * the device width so viewport units and fixed positions behave as on a phone.
 */
const editor = useEditor();
const stage = ref<HTMLElement>();
const html = shallowRef('');
const size = ref({ width: 0, height: 0 });
let observer: ResizeObserver | null = null;

async function render() {
    const result = await renderDraft(editor.state.draft, {
        catalog: editor.catalog.value,
        site: editor.site.value,
        assets: editor.state.workspace.assets,
        slug: editor.state.page?.slug ?? '',
        publicUrl: editor.state.workspace.publicUrl,
        preview: (element) => editor.previews.get(element),
        labels: { loading: editor.t('canvas.loadingPreview'), failed: editor.t('canvas.previewFailed') },
    }, 'public');

    if (result.ok) {
        html.value = result.page.html;
    }
}

watch([() => editor.state.draft, editor.previews.version], render, { deep: true, immediate: true });

onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        size.value = { width: entry?.contentRect.width ?? 0, height: entry?.contentRect.height ?? 0 };
    });

    if (stage.value) {
        observer.observe(stage.value);
    }
});
onBeforeUnmount(() => observer?.disconnect());

const scale = () => clamp((size.value.width - 48) / editor.frameWidth.value, 0.1, 1);
</script>

<template>
    <div ref="stage" class="lze-stage lze-preview">
        <div class="lze-sheet" :style="{ width: `${editor.frameWidth.value * scale()}px`, height: `${size.height - 48}px` }">
            <iframe
                class="lze-frame"
                :title="editor.t('toolbar.preview')"
                :srcdoc="html"
                :style="{ width: `${editor.frameWidth.value}px`, height: `${(size.height - 48) / scale()}px`, transform: `scale(${scale()})` }"
            />
        </div>
    </div>
</template>
