<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { computed, useId } from 'vue';
import { plain } from '../../model/document.ts';
import { navbarPresets } from '../../model/elements.ts';
import { useEditor } from '../../state/editor.ts';
import Button from '../../ui/Button.vue';
import Field from '../../ui/Field.vue';
import SelectInput from '../../ui/SelectInput.vue';
import TextInput from '../../ui/TextInput.vue';
import Toggle from '../../ui/Toggle.vue';
import ActionPicker from '../ActionPicker.vue';

const MAX_LINKS = 8;

const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { brand: useId(), scroll: useId(), layout: useId(), template: useId() };
const presets = navbarPresets(t);
const scrollStyles = (['same', 'shadow', 'solid', 'compact'] as const).map((value) => ({ value, label: t(`el.scroll.${value}`) }));
const templates = (['plain', 'pill', 'card', 'underline', 'divided'] as const).map((value) => ({ value, label: t(`el.navbarTemplate.${value}`) }));
const layouts = (['split', 'left', 'center'] as const).map((value) => ({ value, label: t(`el.layout.${value}`) }));
const links = computed(() => props.element.props.links ?? []);

/** A preset replaces the menu's content and look, never its position or size. */
function applyPreset(preset: (typeof presets)[number]) {
    props.element.props = { ...props.element.props, ...plain(preset.props) };
    props.element.style = { ...props.element.style, ...plain(preset.style) };
    editor.commit();
}

function addLink() {
    props.element.props.links = [...links.value, { label: t('default.link'), action: { type: 'anchor', value: '' } }];
    editor.commit();
}

function removeLink(index: number) {
    props.element.props.links = links.value.filter((_, position) => position !== index);
    editor.commit();
}
</script>

<template>
    <div class="lze-field">
        <span class="lze-label">{{ t('el.presets') }}</span>
        <div class="lze-row">
            <Button v-for="preset in presets" :key="preset.name" @click="applyPreset(preset)">{{ t(preset.name) }}</Button>
        </div>
    </div>
    <Field :id="ids.brand" :label="t('el.brand')">
        <TextInput :id="ids.brand" v-model="element.props.brand" :maxlength="60" :placeholder="t('el.brandPlaceholder')" @commit="editor.commit()" />
    </Field>
    <Toggle v-model="element.props.sticky" :label="t('el.sticky')" @commit="editor.commit()" />
    <Field v-if="element.props.sticky" :id="ids.scroll" :label="t('el.scrollStyle')">
        <SelectInput :id="ids.scroll" :model-value="element.props.scroll_style ?? 'same'" :options="scrollStyles" @update:model-value="element.props.scroll_style = $event" @commit="editor.commit()" />
    </Field>
    <p v-else class="lze-hint">{{ t('el.notSticky') }}</p>
    <Field :id="ids.layout" :label="t('el.layout')">
        <SelectInput :id="ids.layout" :model-value="element.props.layout ?? 'split'" :options="layouts" @update:model-value="element.props.layout = $event" @commit="editor.commit()" />
    </Field>
    <Field :id="ids.template" :label="t('el.navbarTemplate')">
        <SelectInput :id="ids.template" :model-value="element.props.template ?? 'plain'" :options="templates" @update:model-value="element.props.template = $event" @commit="editor.commit()" />
    </Field>
    <div class="lze-field">
        <div class="lze-heading">
            <span class="lze-label">{{ t('el.links') }}</span>
            <Button :disabled="links.length >= MAX_LINKS" @click="addLink">{{ t('common.add') }}</Button>
        </div>
        <fieldset v-for="(link, index) in links" :key="index" class="lze-link-card">
            <legend>{{ t('el.linkN', { n: index + 1 }) }}</legend>
            <div class="lze-row lze-nowrap">
                <TextInput v-model="link.label" :maxlength="40" :label="t('el.linkLabel')" @commit="editor.commit()" />
                <Button variant="danger" @click="removeLink(index)">{{ t('el.removeLink') }}</Button>
            </div>
            <ActionPicker v-model="link.action" :label="t('el.action')" @commit="editor.commit()" />
        </fieldset>
        <p class="lze-hint">{{ t('el.linksHint') }}</p>
    </div>
</template>
