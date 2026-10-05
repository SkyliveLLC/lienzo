<script setup lang="ts">
import type { Submission } from '@skylive/lienzo-core/protocol';
import { computed, ref, watch } from 'vue';
import { canvasesOf } from '../model/document.ts';
import { domId } from '../canvas/render.ts';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import Dialog from '../ui/Dialog.vue';

/** Form submissions, read through the protocol a page of results at a time. */
const editor = useEditor();
const t = editor.t;
const open = editor.dialogModel('submissions');
const submissions = ref<Submission[]>([]);
const next = ref<string | null>(null);
const loading = ref(false);
const date = new Intl.DateTimeFormat(editor.i18n.locale, { dateStyle: 'medium', timeStyle: 'short' });

async function load(cursor: string | null) {
    loading.value = true;
    const result = await editor.client('GET /submissions', cursor ? { cursor } : undefined);
    loading.value = false;

    if (!result.ok) {
        editor.notify(t('submissions.failed', { message: editor.failureText(result.failure) }), 'error');

        return;
    }

    submissions.value = cursor ? [...submissions.value, ...result.value.data] : result.value.data;
    next.value = result.value.next;
}

watch(open, (now) => {
    if (now) {
        void load(null);
    }
});

/** Fields arrive keyed by element id; the open page's field labels read better where they match. */
const labels = computed(() => new Map(canvasesOf(editor.state.draft).flatMap((canvas) => canvas.elements)
    .flatMap((element): [string, string][] => {
        const label = (element.props as { label?: unknown }).label;

        return typeof label === 'string' && label.trim() !== '' ? [[domId(element.id), label.trim()]] : [];
    })));
</script>

<template>
    <Dialog v-model:open="open" :title="t('submissions.title')" :description="t('submissions.description')" size="lg">
        <ul v-if="submissions.length > 0" class="lze-rows">
            <li v-for="submission in submissions" :key="submission.id" class="lze-submission">
                <p class="lze-hint">{{ date.format(new Date(submission.createdAt)) }} · {{ t('submissions.from', { page: submission.page, source: submission.source }) }}</p>
                <dl>
                    <template v-for="(value, name) in submission.fields" :key="name">
                        <dt>{{ labels.get(String(name)) ?? name }}</dt>
                        <dd>{{ typeof value === 'boolean' ? t(value ? 'submissions.checked' : 'submissions.unchecked') : value }}</dd>
                    </template>
                </dl>
            </li>
        </ul>
        <p v-else-if="!loading" class="lze-hint">{{ t('submissions.empty') }}</p>
        <div v-if="next" class="lze-dialog-actions">
            <Button :disabled="loading" @click="load(next)">{{ t('submissions.more') }}</Button>
        </div>
    </Dialog>
</template>
