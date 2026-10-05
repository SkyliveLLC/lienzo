<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { ref, useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import SelectInput from '../../ui/SelectInput.vue';
import TextInput from '../../ui/TextInput.vue';
import Toggle from '../../ui/Toggle.vue';

const MAX_OPTIONS = 30;

/** Form fields: text, long text, dropdown and checkbox. */
const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { label: useId(), type: useId(), options: useId(), placeholder: useId() };
const inputTypes = (['text', 'email', 'tel', 'number', 'date'] as const).map((value) => ({ value, label: t(`el.inputType.${value}`) }));

/** Options are typed one per line. The text stays as typed, so a new empty line is not swallowed. */
const optionsText = ref((props.element.props.options ?? []).join('\n'));

function setOptions(text: string | null | undefined) {
    optionsText.value = text ?? '';
    props.element.props.options = optionsText.value.split('\n').map((option) => option.trim()).filter(Boolean).slice(0, MAX_OPTIONS);
}
</script>

<template>
    <Field :id="ids.label" :label="t('el.fieldLabel')">
        <TextInput :id="ids.label" v-model="element.props.label" :maxlength="120" @commit="editor.commit()" />
    </Field>
    <Field v-if="element.type === 'input'" :id="ids.type" :label="t('el.inputType')">
        <SelectInput :id="ids.type" :model-value="element.props.input_type ?? 'text'" :options="inputTypes" @update:model-value="element.props.input_type = $event" @commit="editor.commit()" />
    </Field>
    <Field v-if="element.type === 'select'" :id="ids.options" :label="t('el.options')" :hint="t('el.optionsHint')">
        <TextInput :id="ids.options" :model-value="optionsText" :rows="4" @update:model-value="setOptions" @commit="editor.commit()" />
    </Field>
    <Field v-if="element.type !== 'checkbox'" :id="ids.placeholder" :label="t('el.placeholder')">
        <TextInput :id="ids.placeholder" v-model="element.props.placeholder" :maxlength="120" @commit="editor.commit()" />
    </Field>
    <Toggle v-model="element.props.required" :label="t('el.required')" @commit="editor.commit()" />
</template>
