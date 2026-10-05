<script setup lang="ts">
import { Eye, History, Monitor, PencilLine, Plus, Redo2, Smartphone, Undo2 } from '@lucide/vue';
import { computed } from 'vue';
import Button from '../ui/Button.vue';
import { issueText, useEditor } from '../state/editor.ts';

/** The editor's top bar: which page, how saving goes, the device, and publishing. */
const editor = useEditor();
const t = editor.t;
const page = computed(() => editor.state.page);

const time = new Intl.DateTimeFormat(editor.i18n.locale, { hour: '2-digit', minute: '2-digit' });

const status = computed((): { text: string; tone: 'muted' | 'warning' | 'danger'; retry: boolean } => {
    const save = editor.saveState.value;

    switch (save.kind) {
        case 'saved':
            return { text: save.at ? t('save.saved', { time: time.format(save.at) }) : t('save.idle'), tone: 'muted', retry: false };
        case 'pending':
            return { text: t('save.pending'), tone: 'muted', retry: false };
        case 'saving':
            return { text: t('save.saving'), tone: 'muted', retry: false };
        case 'offline':
            return { text: t('save.offline'), tone: 'warning', retry: true };
        case 'failed':
            return { text: t('save.failed', { message: save.message }), tone: 'danger', retry: true };
        case 'invalid':
            return { text: t('save.invalid', { issue: issueText(save.issues[0]) || save.message }), tone: 'danger', retry: false };
        case 'conflict':
            return { text: t('save.conflict'), tone: 'danger', retry: false };
    }
});

const publicUrl = computed(() => {
    const base = editor.state.workspace.publicUrl;

    return base && page.value ? new URL(page.value.slug, base.endsWith('/') ? base : `${base}/`).href : null;
});

function choosePage(event: Event) {
    void editor.openPage(Number((event.target as HTMLSelectElement).value));
}
</script>

<template>
    <header class="lze-toolbar">
        <div class="lze-toolbar-group">
            <strong class="lze-site-name">{{ editor.state.workspace.site.name }}</strong>
            <select v-if="page" class="lze-select lze-page-select" :aria-label="t('toolbar.pageSelect')" :value="page.id" @change="choosePage">
                <option v-for="item in editor.state.workspace.pages" :key="item.id" :value="item.id">{{ item.title }}{{ item.slug ? ` /${item.slug}` : '' }}</option>
            </select>
            <Button variant="ghost" :title="t('toolbar.newPageHint')" @click="editor.state.dialog = 'newPage'"><Plus :size="16" aria-hidden="true" />{{ t('toolbar.newPage') }}</Button>
            <span v-if="page" class="lze-badge-status" :data-published="page.publishedAt !== null">{{ page.publishedAt ? t('status.published') : t('status.unpublished') }}</span>
            <span class="lze-save-status" :data-tone="status.tone" data-testid="save-status" aria-live="polite">{{ status.text }}</span>
            <Button v-if="status.retry" variant="ghost" @click="editor.retrySave()">{{ t('save.retry') }}</Button>
            <Button v-if="editor.saveState.value.kind === 'conflict'" variant="primary" @click="editor.reloadPage()">{{ t('conflict.reload') }}</Button>
        </div>

        <div class="lze-toolbar-group">
            <div class="lze-segmented" role="group">
                <button
                    v-for="option in (['desktop', 'mobile'] as const)"
                    :key="option"
                    type="button"
                    :title="option === 'desktop' ? t('toolbar.desktop') : t('toolbar.mobile')"
                    :aria-label="option === 'desktop' ? t('toolbar.desktop') : t('toolbar.mobile')"
                    :aria-pressed="editor.state.device === option"
                    @click="editor.state.device = option"
                >
                    <Monitor v-if="option === 'desktop'" :size="16" aria-hidden="true" />
                    <Smartphone v-else :size="16" aria-hidden="true" />
                </button>
            </div>
            <button type="button" class="lze-icon-btn" :title="t('toolbar.undo')" :aria-label="t('toolbar.undo')" :disabled="!editor.canUndo.value" @click="editor.undo()"><Undo2 :size="16" aria-hidden="true" /></button>
            <button type="button" class="lze-icon-btn" :title="t('toolbar.redo')" :aria-label="t('toolbar.redo')" :disabled="!editor.canRedo.value" @click="editor.redo()"><Redo2 :size="16" aria-hidden="true" /></button>
            <Button variant="ghost" :title="editor.state.previewing ? t('toolbar.editHint') : t('toolbar.previewHint')" @click="editor.state.previewing = !editor.state.previewing">
                <PencilLine v-if="editor.state.previewing" :size="16" aria-hidden="true" />
                <Eye v-else :size="16" aria-hidden="true" />
                {{ editor.state.previewing ? t('toolbar.edit') : t('toolbar.preview') }}
            </Button>
            <Button v-if="page?.versions.length" variant="ghost" :title="t('toolbar.versionsHint')" @click="editor.state.dialog = 'versions'"><History :size="16" aria-hidden="true" />{{ t('toolbar.versions') }}</Button>
            <Button variant="ghost" :title="t('toolbar.submissionsHint')" @click="editor.state.dialog = 'submissions'">{{ t('toolbar.submissions') }}</Button>
            <Button variant="ghost" @click="editor.state.dialog = 'theme'">{{ t('toolbar.theme') }}</Button>
            <Button variant="ghost" :title="t('toolbar.siteHint')" @click="editor.state.dialog = 'site'">{{ t('toolbar.site') }}</Button>
            <a v-if="publicUrl" class="lze-btn" :href="publicUrl" target="_blank" rel="noopener noreferrer">{{ t('toolbar.viewSite') }}</a>
            <Button variant="primary" :disabled="editor.state.publishing || !page" @click="editor.publish()">
                {{ editor.state.publishing ? t('toolbar.publishing') : t('toolbar.publish') }}
            </Button>
        </div>
    </header>
</template>
