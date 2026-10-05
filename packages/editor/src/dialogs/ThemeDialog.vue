<script setup lang="ts">
import type { Issue, Theme, ThemeToken } from '@skylivellc/lienzo-core';
import { computed, reactive, ref, useId, watch } from 'vue';
import { plain } from '../model/document.ts';
import { FONTS, fontNote, fontsHref, linkToPalette, MAX_WIDTHS, PALETTES, THEME_TOKENS, widthLabel, type Palette } from '../model/theme.ts';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import Dialog from '../ui/Dialog.vue';
import Field from '../ui/Field.vue';
import RangeInput from '../ui/RangeInput.vue';
import SelectInput from '../ui/SelectInput.vue';

/**
 * Edits the site theme. While open, every valid change goes to
 * `state.themeDraft`, so the canvas previews it; saving stores it, closing drops it.
 */
const editor = useEditor();
const t = editor.t;
const ids = { heading: useId(), body: useId(), width: useId() };
const HEX = /^#[0-9a-fA-F]{6}$/;

const open = editor.dialogModel('theme');

/** The form keeps what is typed, even a half-written hex; only valid colors reach the canvas. */
const form = reactive<Theme>(plain(editor.state.workspace.site.theme));
const issues = ref<Issue[]>([]);
const saving = ref(false);

const valid = computed((): Theme => {
    const saved = editor.state.workspace.site.theme;
    const colors = Object.fromEntries(THEME_TOKENS.map((token) => [token, HEX.test(form[token]) ? form[token] : saved[token]])) as Palette;

    return { ...form, ...colors };
});

watch(open, (now) => {
    if (now) {
        Object.assign(form, plain(editor.state.workspace.site.theme));
        issues.value = [];
    }

    editor.state.themeDraft = now ? plain(valid.value) : null;
}, { immediate: true });

watch(valid, (theme) => {
    if (open.value) {
        editor.state.themeDraft = plain(theme);
    }
});

const fonts = FONTS.map((font) => ({ value: font, label: `${font} · ${t(fontNote(font))}` }));
const widths = MAX_WIDTHS.map((width) => ({ value: width, label: t(widthLabel(width)) }));

function applyPalette(colors: Palette) {
    Object.assign(form, colors);
}

function linkElements() {
    linkToPalette(editor.state.draft, valid.value);
    editor.commit();
}

async function save() {
    saving.value = true;
    issues.value = await editor.updateSite({ theme: valid.value });
    saving.value = false;

    if (issues.value.length === 0) {
        open.value = false;
        editor.notify(t('theme.saved'));
    }
}

const colorOf = (token: ThemeToken) => valid.value[token];
</script>

<template>
    <Dialog v-model:open="open" :title="t('theme.title')" :description="t('theme.description')" size="xl">
        <link rel="stylesheet" :href="fontsHref([valid.heading_font, valid.body_font])" />
        <form class="lze-stack" novalidate @submit.prevent="save">
            <section class="lze-field">
                <h3 class="lze-label">{{ t('theme.palettes') }}</h3>
                <div class="lze-row">
                    <button v-for="palette in PALETTES" :key="palette.name" type="button" class="lze-palette-choice" @click="applyPalette(palette.colors)">
                        <span class="lze-row" aria-hidden="true">
                            <span v-for="token in ['primary', 'secondary', 'surface'] as const" :key="token" class="lze-dot" :style="{ background: palette.colors[token] }" />
                        </span>
                        {{ t(palette.name) }}
                    </button>
                </div>
            </section>

            <section class="lze-field">
                <div class="lze-heading">
                    <h3 class="lze-label">{{ t('theme.colors') }}</h3>
                    <Button @click="linkElements">{{ t('theme.link') }}</Button>
                </div>
                <p class="lze-hint">{{ t('theme.linkHint') }}</p>
                <div class="lze-theme-colors">
                    <div v-for="token in THEME_TOKENS" :key="token" class="lze-theme-color">
                        <span>{{ t(`token.${token}`) }}</span>
                        <input v-model="form[token]" class="lze-input lze-hex" maxlength="7" spellcheck="false" :aria-label="t('theme.hex', { label: t(`token.${token}`) })" />
                        <input type="color" :value="colorOf(token)" :aria-label="t(`token.${token}`)" @input="form[token] = ($event.target as HTMLInputElement).value" />
                    </div>
                </div>
            </section>

            <section class="lze-grid-2">
                <Field :id="ids.heading" :label="t('theme.headingFont')">
                    <SelectInput :id="ids.heading" :model-value="form.heading_font" :options="fonts" @update:model-value="form.heading_font = $event ?? form.heading_font" />
                </Field>
                <Field :id="ids.body" :label="t('theme.bodyFont')">
                    <SelectInput :id="ids.body" :model-value="form.body_font" :options="fonts" @update:model-value="form.body_font = $event ?? form.body_font" />
                </Field>
            </section>

            <section class="lze-grid-2">
                <RangeInput :model-value="form.radius" :label="t('theme.radius')" :min="0" :max="40" :step="2" :format="(value) => `${value} px`" @update:model-value="form.radius = $event ?? form.radius" />
                <Field :id="ids.width" :label="t('theme.maxWidth')">
                    <SelectInput :id="ids.width" :model-value="form.max_width" :options="widths" @update:model-value="form.max_width = $event ?? form.max_width" />
                </Field>
            </section>

            <section
                class="lze-theme-preview"
                :aria-label="t('theme.previewLabel')"
                :style="{ background: valid.surface, color: valid.text, borderRadius: `${valid.radius}px` }"
            >
                <p class="lze-theme-preview-heading" :style="{ fontFamily: `'${valid.heading_font}', sans-serif` }">{{ t('theme.previewHeading') }}</p>
                <p :style="{ fontFamily: `'${valid.body_font}', sans-serif`, color: valid.muted }">{{ t('theme.previewText') }}</p>
                <span
                    class="lze-theme-preview-button"
                    :style="{ background: valid.primary, color: valid.background, borderRadius: `${valid.radius}px`, fontFamily: `'${valid.body_font}', sans-serif` }"
                >
                    {{ t('theme.previewButton') }}
                </span>
            </section>

            <p v-for="issue in issues" :key="issue.path + issue.message" class="lze-error" role="alert">{{ issue.path ? `${issue.path}: ` : '' }}{{ issue.message }}</p>
            <div class="lze-dialog-actions">
                <Button variant="primary" size="md" type="submit" :disabled="saving">{{ t('theme.save') }}</Button>
                <Button size="md" @click="open = false">{{ t('common.cancel') }}</Button>
            </div>
        </form>
    </Dialog>
</template>
