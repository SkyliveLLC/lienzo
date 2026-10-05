<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import ColorPicker from '../../ui/ColorPicker.vue';
import Field from '../../ui/Field.vue';
import SelectInput from '../../ui/SelectInput.vue';
import TextInput from '../../ui/TextInput.vue';

/** Heading and text: the copy, a highlighted part, and for headings their level. */
defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { text: useId(), accent: useId(), level: useId() };
const levels = ([1, 2, 3, 4] as const).map((level) => ({ value: level, label: t(`el.level.${level}`) }));
</script>

<template>
    <Field :id="ids.text" :label="t('el.text')">
        <TextInput :id="ids.text" v-model="element.props.text" :rows="3" :maxlength="2000" @commit="editor.commit()" />
    </Field>
    <Field :id="ids.accent" :label="t('el.accent')">
        <TextInput :id="ids.accent" v-model="element.props.accent" :maxlength="120" :placeholder="t('el.accentPlaceholder')" @commit="editor.commit()" />
    </Field>
    <ColorPicker v-if="element.props.accent" v-model="element.style.accent_color" :label="t('el.accentColor')" @commit="editor.commit()" />
    <Field v-if="element.type === 'heading'" :id="ids.level" :label="t('el.level')">
        <SelectInput :id="ids.level" v-model="element.props.level" :options="levels" @commit="editor.commit()" />
    </Field>
</template>
