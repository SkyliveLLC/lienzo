<script setup lang="ts">
import type { FieldValue, Issue } from '@skylive/lienzo-core';
import type { SiteMeta } from '@skylive/lienzo-core/protocol';
import { computed, reactive, useId, watch } from 'vue';
import { plain } from '../model/document.ts';
import FieldControl from '../panels/FieldControl.vue';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import Dialog from '../ui/Dialog.vue';
import Field from '../ui/Field.vue';
import ImageField from '../ui/ImageField.vue';
import TextInput from '../ui/TextInput.vue';

/**
 * Site-wide settings: search engine defaults, share image, favicon, language,
 * and whatever site fields the app declares (stored in `meta`).
 */
const editor = useEditor();
const t = editor.t;
const ids = { seoTitle: useId(), seoDescription: useId(), locale: useId() };
const open = computed({
    get: () => editor.state.dialog === 'site',
    set: (value) => {
        if (!value && editor.state.dialog === 'site') {
            editor.state.dialog = null;
        }
    },
});

const blank = () => {
    const site = editor.state.workspace.site;

    return {
        seoTitle: site.seo.title ?? '',
        seoDescription: site.seo.description ?? '',
        ogImage: site.og_image,
        favicon: site.favicon,
        locale: site.locale,
        meta: plain(editor.state.workspace.meta) as SiteMeta,
        issues: [] as Issue[],
        saving: false,
    };
};
const form = reactive(blank());
watch(open, (now) => now && Object.assign(form, blank()));

const fields = computed(() => editor.catalog.value.siteFields ?? []);
const nullIfBlank = (value: string | null | undefined) => (value && value.trim() !== '' ? value : null);

const PATHS = ['seo.title', 'seo.description', 'og_image', 'favicon', 'locale'];
const issueAt = (path: string) => form.issues.filter((issue) => issue.path === path).map((issue) => issue.message).join(' ') || null;
const otherIssues = computed(() => form.issues.filter((issue) => !PATHS.includes(issue.path) && !issue.path.startsWith('meta.')));

function setMeta(key: string, value: FieldValue) {
    form.meta = { ...form.meta, [key]: value };
}

async function save() {
    form.saving = true;
    form.issues = await editor.updateSite({
        seo: { title: nullIfBlank(form.seoTitle), description: nullIfBlank(form.seoDescription) },
        og_image: nullIfBlank(form.ogImage),
        favicon: nullIfBlank(form.favicon),
        locale: form.locale.trim(),
        meta: form.meta,
    });
    form.saving = false;

    if (form.issues.length === 0) {
        open.value = false;
        editor.notify(t('site.saved'));
    }
}
</script>

<template>
    <Dialog v-model:open="open" :title="t('site.title')" :description="t('site.description')" size="lg">
        <form class="lze-stack" novalidate @submit.prevent="save">
            <Field :id="ids.seoTitle" :label="t('site.seoTitle')" :error="issueAt('seo.title')">
                <TextInput :id="ids.seoTitle" v-model="form.seoTitle" :maxlength="120" />
            </Field>
            <Field :id="ids.seoDescription" :label="t('site.seoDescription')" :error="issueAt('seo.description')">
                <TextInput :id="ids.seoDescription" v-model="form.seoDescription" :rows="3" :maxlength="300" />
            </Field>
            <div class="lze-grid-2">
                <div class="lze-field">
                    <ImageField v-model="form.ogImage" :label="t('site.shareImage')" :choose="t('common.choose')" />
                    <p v-if="issueAt('og_image')" class="lze-error" role="alert">{{ issueAt('og_image') }}</p>
                    <p v-else class="lze-hint">{{ t('site.shareImageHint') }}</p>
                </div>
                <div class="lze-field">
                    <ImageField v-model="form.favicon" :label="t('site.favicon')" :choose="t('common.choose')" thumb="icon" />
                    <p v-if="issueAt('favicon')" class="lze-error" role="alert">{{ issueAt('favicon') }}</p>
                </div>
            </div>
            <Field :id="ids.locale" :label="t('site.locale')" :hint="t('site.localeHint')" :error="issueAt('locale')">
                <TextInput :id="ids.locale" v-model="form.locale" :maxlength="5" placeholder="en" />
            </Field>
            <section v-if="fields.length > 0" class="lze-stack lze-divided">
                <h3 class="lze-label">{{ t('site.details') }}</h3>
                <div v-for="field in fields" :key="field.key" class="lze-field">
                    <FieldControl :field="field" :model-value="form.meta[field.key]" @update:model-value="setMeta(field.key, $event)" />
                    <p v-if="issueAt(`meta.${field.key}`)" class="lze-error" role="alert">{{ issueAt(`meta.${field.key}`) }}</p>
                </div>
            </section>
            <p v-for="issue in otherIssues" :key="issue.path + issue.message" class="lze-error" role="alert">{{ issue.path ? `${issue.path}: ` : '' }}{{ issue.message }}</p>
            <div class="lze-dialog-actions">
                <Button variant="primary" size="md" type="submit" :disabled="form.saving">{{ t('site.save') }}</Button>
                <Button size="md" @click="open = false">{{ t('common.cancel') }}</Button>
            </div>
        </form>
    </Dialog>
</template>
