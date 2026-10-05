<script setup lang="ts">
import type { Issue } from '@skylive/lienzo-core';
import { computed, ref, useId, watch } from 'vue';
import { PAGE_TEMPLATES } from '../model/templates.ts';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import Field from '../ui/Field.vue';
import TextInput from '../ui/TextInput.vue';

/** The Page tab: title, address, search engine text, templates and shortcuts. Title and SEO save with the draft. */
const editor = useEditor();
const t = editor.t;
const ids = { title: useId(), slug: useId(), seoTitle: useId(), description: useId() };
const page = computed(() => editor.state.page);

const slug = ref(page.value?.slug ?? '');
const slugIssues = ref<Issue[]>([]);
const saving = ref(false);
watch(() => page.value?.id, () => {
    slug.value = page.value?.slug ?? '';
    slugIssues.value = [];
});

const isEmpty = computed(() => editor.state.draft.sections.every((section) => section.elements.length === 0));

async function saveAddress() {
    saving.value = true;
    slugIssues.value = await editor.renamePage(slug.value.trim());
    saving.value = false;
}

function deletePage() {
    if (page.value && window.confirm(t('page.deleteConfirm', { title: page.value.title }))) {
        void editor.deletePage();
    }
}
</script>

<template>
    <div v-if="page" class="lze-stack">
        <Field :id="ids.title" :label="t('page.title')">
            <TextInput :id="ids.title" v-model="page.title" :maxlength="120" />
        </Field>
        <Field v-if="page.slug === ''" :label="t('page.address')" :hint="t('page.homeHint')">
            <p class="lze-slug-static"><span class="lze-slug-root" aria-hidden="true">/</span>{{ t('page.home') }}</p>
        </Field>
        <template v-else>
            <Field :id="ids.slug" :label="t('page.address')" :error="slugIssues.map((issue) => issue.message).join(' ') || null">
                <div class="lze-slug">
                    <span aria-hidden="true">/</span>
                    <TextInput :id="ids.slug" v-model="slug" :maxlength="120" :placeholder="t('newPage.slugPlaceholder')" />
                </div>
            </Field>
            <div class="lze-row">
                <Button :disabled="saving || slug.trim() === page.slug" @click="saveAddress">{{ t('page.saveAddress') }}</Button>
                <Button variant="danger" @click="deletePage">{{ t('page.delete') }}</Button>
            </div>
        </template>
        <div v-if="isEmpty" class="lze-field lze-divided">
            <span class="lze-label">{{ t('page.templates') }}</span>
            <button v-for="template in PAGE_TEMPLATES" :key="template.key" type="button" class="lze-choice" @click="editor.applyPageTemplate(template.key)">
                <strong>{{ t(template.name) }}</strong>
                <span class="lze-hint">{{ t(template.note) }}</span>
            </button>
        </div>
        <Field :id="ids.seoTitle" :label="t('page.seoTitle')" :hint="t('page.seoTitleHint')">
            <TextInput :id="ids.seoTitle" v-model="page.seo.title" :maxlength="120" />
        </Field>
        <Field :id="ids.description" :label="t('page.description')">
            <TextInput :id="ids.description" v-model="page.seo.description" :rows="3" :maxlength="300" />
        </Field>
        <div class="lze-field lze-divided">
            <span class="lze-label">{{ t('page.shortcuts') }}</span>
            <ul class="lze-shortcuts lze-hint">
                <li>{{ t('page.shortcutUndo') }}</li>
                <li>{{ t('page.shortcutSave') }}</li>
                <li>{{ t('page.shortcutCopy') }}</li>
                <li>{{ t('page.shortcutNudge') }}</li>
            </ul>
        </div>
    </div>
</template>
