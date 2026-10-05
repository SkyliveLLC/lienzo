<script setup lang="ts">
import type { Section } from '@skylivellc/lienzo-core';
import { Trash2 } from '@lucide/vue';
import { ref, useId, watch } from 'vue';
import { findCanvas } from '../model/document.ts';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import ColorPicker from '../ui/ColorPicker.vue';
import Field from '../ui/Field.vue';
import IconButton from '../ui/IconButton.vue';
import ImageField from '../ui/ImageField.vue';
import NumberInput from '../ui/NumberInput.vue';
import RangeInput from '../ui/RangeInput.vue';
import SelectInput from '../ui/SelectInput.vue';
import TextInput from '../ui/TextInput.vue';
import Toggle from '../ui/Toggle.vue';
import GradientEditor from './GradientEditor.vue';

/** Settings of the selected section. */
const props = defineProps<{ section: Section }>();
const editor = useEditor();
const t = editor.t;
const ids = { group: useId(), label: useId(), anchor: useId(), background: useId() };

const groupModes = [
    { value: 'alone', label: t('section.alone') },
    { value: 'tabs', label: t('section.tab') },
    { value: 'steps', label: t('section.step') },
] as const;
const backgrounds = (['color', 'gradient', 'image'] as const).map((value) => ({ value, label: t(`fill.${value}`) }));

/**
 * The id is what selection and anchor links point at, so it changes when the
 * field is committed, and only to an id an anchor can use and no other canvas has.
 */
const anchor = ref(props.section.id);
const anchorInvalid = ref(false);
watch(() => props.section.id, (id) => (anchor.value = id));

function saveAnchor() {
    const next = anchor.value.trim();
    const taken = next !== props.section.id && findCanvas(editor.state.draft, next) !== undefined;
    anchorInvalid.value = !/^[a-zA-Z0-9_-]{1,40}$/.test(next) || taken;

    if (anchorInvalid.value || next === props.section.id) {
        return;
    }

    props.section.id = next;
    editor.selectCanvas(next);
    editor.commit();
}

function setBackground(type: Section['background']['type'] | null | undefined) {
    const background = props.section.background;

    if (!type) {
        return;
    }

    background.type = type;

    if (type === 'gradient') {
        background.gradient ??= { type: 'linear', from: 'primary', to: 'secondary', angle: 135 };
    }

    editor.commit();
}

function setImage(image: string | null | undefined) {
    props.section.background.image = image ?? null;
    props.section.background.type = image ? 'image' : 'color';
}
</script>

<template>
    <div class="lze-stack">
        <div class="lze-heading">
            <h2 class="lze-panel-title">{{ t('section.heading') }}</h2>
            <IconButton v-if="editor.state.draft.sections.length > 1" :label="t('section.delete')" tone="danger" @click="editor.removeSection(section.id)">
                <Trash2 :size="16" aria-hidden="true" />
            </IconButton>
        </div>
        <Field :id="ids.group" :label="t('section.shownAs')" :hint="t('section.groupHint')">
            <SelectInput :id="ids.group" :model-value="section.group?.type ?? 'alone'" :options="groupModes" @update:model-value="editor.setSectionGroup(section, $event ?? 'alone')" />
            <TextInput v-if="section.group" v-model="section.group.label" :maxlength="60" :placeholder="t('section.groupLabel')" :label="t('section.groupLabel')" @commit="editor.commit()" />
        </Field>
        <Field :id="ids.anchor" :label="t('section.anchor')" :hint="t('section.anchorHint')" :error="anchorInvalid ? t('section.anchorInvalid') : null">
            <TextInput :id="ids.anchor" v-model="anchor" :maxlength="40" @commit="saveAnchor" />
        </Field>
        <div class="lze-row">
            <Button @click="editor.fitCanvas(section)">{{ t('section.fitHeight') }}</Button>
            <Button @click="editor.generateMobile(section)">{{ t('section.generateMobile') }}</Button>
        </div>
        <div class="lze-field">
            <NumberInput
                :model-value="section.height.desktop"
                :label="t('section.heightDesktop')"
                :min="80"
                :max="3000"
                @update:model-value="section.height.desktop = $event ?? section.height.desktop"
                @commit="editor.commit()"
            />
            <NumberInput
                :model-value="section.height.mobile"
                :label="t('section.heightMobile')"
                :min="80"
                :max="4000"
                @update:model-value="section.height.mobile = $event ?? section.height.mobile"
                @commit="editor.commit()"
            />
        </div>
        <Field :id="ids.background" :label="t('section.background')">
            <SelectInput :id="ids.background" :model-value="section.background.type" :options="backgrounds" @update:model-value="setBackground" />
        </Field>
        <ColorPicker v-if="section.background.type === 'color'" v-model="section.background.color" :label="t('section.color')" @commit="editor.commit()" />
        <GradientEditor v-else-if="section.background.type === 'gradient'" v-model="section.background.gradient" @commit="editor.commit()" />
        <template v-else>
            <ImageField :model-value="section.background.image" :label="t('section.image')" :choose="t('section.chooseImage')" @update:model-value="setImage" @commit="editor.commit()" />
            <Toggle v-model="section.background.parallax" :label="t('section.parallax')" @commit="editor.commit()" />
            <RangeInput
                v-model="section.background.overlay"
                :label="t('section.overlay')"
                :min="0"
                :max="0.8"
                :step="0.05"
                :format="(value) => `${Math.round(value * 100)}%`"
                @commit="editor.commit()"
            />
        </template>
    </div>
</template>
