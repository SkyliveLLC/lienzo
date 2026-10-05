<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref, watchEffect } from 'vue';
import Canvas from './canvas/Canvas.vue';
import Preview from './canvas/Preview.vue';
import { createClient } from './client.ts';
import ConflictDialog from './dialogs/ConflictDialog.vue';
import MediaLibrary from './dialogs/MediaLibrary.vue';
import NewPageDialog from './dialogs/NewPageDialog.vue';
import SiteDialog from './dialogs/SiteDialog.vue';
import SubmissionsDialog from './dialogs/SubmissionsDialog.vue';
import ThemeDialog from './dialogs/ThemeDialog.vue';
import VersionsDialog from './dialogs/VersionsDialog.vue';
import { createTranslator, type MessageOverrides } from './i18n/index.ts';
import { fontsHref } from './model/theme.ts';
import LeftSidebar from './shell/LeftSidebar.vue';
import RightPanel from './shell/RightPanel.vue';
import Toolbar from './shell/Toolbar.vue';
import { createEditor, editorKey } from './state/editor.ts';
import { handleShortcut } from './state/shortcuts.ts';
import { adoptEditorStyles } from './styles/index.ts';
import Button from './ui/Button.vue';
import Toasts from './ui/Toasts.vue';

/**
 * The Lienzo editor. Give it the protocol `endpoint` of a backend (see
 * `@skylive/lienzo-core/protocol`); everything else is optional. Props are
 * read once, when the editor mounts.
 */
const props = defineProps<{
    /** Base URL of the protocol, for example `/admin/site/lienzo`. */
    endpoint: string;
    /** Language of the editor itself. Defaults to English. */
    locale?: string;
    /** Extra or overriding strings by locale; partial packs fall back to English per key. */
    messages?: MessageOverrides;
    /** Extra request headers, such as a bearer token. Session cookies and Laravel's XSRF token work without any. */
    headers?: Record<string, string>;
    /** A fetch implementation to use instead of the global one. */
    fetch?: typeof fetch;
}>();

const i18n = createTranslator(props.locale ?? 'en', props.messages);
const editor = createEditor({
    client: createClient({ endpoint: props.endpoint, headers: props.headers, fetch: props.fetch }),
    i18n,
});
provide(editorKey, editor);

const root = ref<HTMLElement>();
const canvas = ref<InstanceType<typeof Canvas>>();
const dropPoint = (x: number, y: number) => canvas.value?.dropPoint(x, y) ?? null;

/** Shortcuts work wherever focus is, unless it is inside another part of the host page. */
function onKeyDown(event: KeyboardEvent) {
    const inside = event.composedPath().some((target) => target === root.value);
    const onPage = event.target === document.body || event.target === document.documentElement;

    if ((inside || onPage) && editor.state.load.kind === 'ready') {
        handleShortcut(editor, event);
    }
}

/**
 * Theme fonts in the host document too: the theme dialog previews them in the
 * chrome, and fonts declared inside a shadow root do not load.
 */
let fonts: HTMLLinkElement | null = null;

watchEffect(() => {
    const theme = editor.theme.value;

    if (editor.state.load.kind !== 'ready' || typeof document === 'undefined') {
        return;
    }

    fonts ??= document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet' }));
    fonts.href = fontsHref([theme.heading_font, theme.body_font]);
});

onMounted(() => {
    if (root.value) {
        adoptEditorStyles(root.value);
    }

    window.addEventListener('keydown', onKeyDown);
    void editor.load();
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeyDown);
    fonts?.remove();
    editor.dispose();
});
</script>

<template>
    <div ref="root" class="lze-root" :lang="i18n.locale">
        <div v-if="editor.state.load.kind === 'loading'" class="lze-center">{{ editor.t('load.loading') }}</div>
        <div v-else-if="editor.state.load.kind === 'failed'" class="lze-center" role="alert">
            <p>{{ editor.t('load.failed', { message: editor.state.load.message }) }}</p>
            <Button @click="editor.load()">{{ editor.t('load.retry') }}</Button>
        </div>
        <div v-else-if="editor.state.load.kind === 'empty'" class="lze-center">
            <Button variant="primary" @click="editor.state.dialog = 'newPage'">{{ editor.t('newPage.title') }}</Button>
        </div>
        <template v-else>
            <Toolbar />
            <div class="lze-body">
                <LeftSidebar :drop-point="dropPoint" />
                <main class="lze-main">
                    <Preview v-if="editor.state.previewing" />
                    <Canvas v-else ref="canvas" />
                </main>
                <RightPanel />
            </div>
        </template>
        <NewPageDialog />
        <VersionsDialog />
        <ThemeDialog />
        <SiteDialog />
        <SubmissionsDialog />
        <ConflictDialog />
        <MediaLibrary />
        <Toasts />
    </div>
</template>
