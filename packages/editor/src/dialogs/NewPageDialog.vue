<script setup lang="ts">
import type { Issue } from '@skylivellc/lienzo-core';
import { computed, reactive, useId, watch } from 'vue';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import Dialog from '../ui/Dialog.vue';
import Field from '../ui/Field.vue';
import TextInput from '../ui/TextInput.vue';

/** Creates a page at its own address; the backend checks the address is free. */
const editor = useEditor();
const t = editor.t;
const ids = { title: useId(), slug: useId() };
const open = editor.dialogModel('newPage');

const form = reactive({ title: '', slug: '', issues: [] as Issue[], creating: false });
watch(open, (now) => {
    if (now) {
        Object.assign(form, { title: '', slug: '', issues: [], creating: false });
    }
});

/** Where the page will live, resolved against the site root like the published links. */
const address = computed(() => {
    const slug = form.slug.trim() || t('newPage.slugFallback');

    return editor.state.workspace.publicUrl ? new URL(slug, editor.state.workspace.publicUrl).href : `/${slug}`;
});

const issueAt = (path: string) => form.issues.filter((issue) => issue.path === path).map((issue) => issue.message).join(' ') || null;
const otherIssues = computed(() => form.issues.filter((issue) => issue.path !== 'title' && issue.path !== 'slug'));

async function create() {
    form.creating = true;
    form.issues = await editor.createPage(form.title.trim(), form.slug.trim());
    form.creating = false;
}
</script>

<template>
    <Dialog v-model:open="open" :title="t('newPage.title')" :description="t('newPage.description')">
        <form class="lze-stack" novalidate @submit.prevent="create">
            <Field :id="ids.title" :label="t('newPage.titleLabel')" :error="issueAt('title')">
                <TextInput :id="ids.title" v-model="form.title" :maxlength="120" />
            </Field>
            <Field :id="ids.slug" :label="t('newPage.slug')" :error="issueAt('slug')" :hint="t('newPage.at', { url: address })">
                <TextInput :id="ids.slug" v-model="form.slug" :maxlength="120" :placeholder="t('newPage.slugPlaceholder')" />
            </Field>
            <p v-for="issue in otherIssues" :key="issue.path + issue.message" class="lze-error" role="alert">{{ issue.message }}</p>
            <div class="lze-dialog-actions">
                <Button variant="primary" size="md" type="submit" :disabled="form.creating">{{ t('newPage.create') }}</Button>
                <Button size="md" @click="open = false">{{ t('common.cancel') }}</Button>
            </div>
        </form>
    </Dialog>
</template>
