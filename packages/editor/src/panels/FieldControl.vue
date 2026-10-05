<script setup lang="ts">
import type { Action, Field, FieldValue } from '@skylive/lienzo-core';
import { computed, useId } from 'vue';
import { useEditor } from '../state/editor.ts';
import FieldShell from '../ui/Field.vue';
import ImageField from '../ui/ImageField.vue';
import NumberInput from '../ui/NumberInput.vue';
import SelectInput from '../ui/SelectInput.vue';
import TextInput from '../ui/TextInput.vue';
import Toggle from '../ui/Toggle.vue';
import ActionPicker from './ActionPicker.vue';

/**
 * One control for a field the app declared (app element props, site fields,
 * app action values). The control and the value's type follow the field's kind.
 */
const props = defineProps<{ field: Field; modelValue: FieldValue | undefined }>();
const emit = defineEmits<{ 'update:modelValue': [value: FieldValue]; commit: [] }>();
const editor = useEditor();
const id = useId();
const label = computed(() => editor.i18n.localized(props.field.label));

type Of<K extends Field['kind']> = Extract<Field, { kind: K }>;
type Control =
    | { kind: 'text'; field: Of<'text'>; value: string }
    | { kind: 'number'; field: Of<'number'>; value: number }
    | { kind: 'toggle'; field: Of<'toggle'>; value: boolean }
    | { kind: 'choice'; field: Of<'choice'>; value: string }
    | { kind: 'image'; field: Of<'image'>; value: string | null }
    | { kind: 'action'; field: Of<'action'>; value: Action | null };

const isAction = (value: unknown): value is Action => typeof value === 'object' && value !== null;

/** The field with its current value in the field's own type; a missing or mistyped value shows the default. */
const control = computed((): Control => {
    const field = props.field;
    const value = props.modelValue;

    switch (field.kind) {
        case 'text':
            return { kind: 'text', field, value: typeof value === 'string' ? value : (field.default ?? '') };
        case 'number':
            return { kind: 'number', field, value: typeof value === 'number' ? value : field.default };
        case 'toggle':
            return { kind: 'toggle', field, value: typeof value === 'boolean' ? value : field.default };
        case 'choice':
            return { kind: 'choice', field, value: typeof value === 'string' ? value : field.default };
        case 'image':
            return { kind: 'image', field, value: typeof value === 'string' && value !== '' ? value : null };
        case 'action':
            return { kind: 'action', field, value: isAction(value) ? value : null };
        default: {
            const unknown: never = field;

            return unknown;
        }
    }
});

function update(value: FieldValue | undefined) {
    if (value !== undefined) {
        emit('update:modelValue', value);
    }
}
</script>

<template>
    <FieldShell v-if="control.kind === 'text'" :id="id" :label="label">
        <TextInput :id="id" :model-value="control.value" :maxlength="control.field.max" :rows="control.field.multiline ? 4 : 0" @update:model-value="update($event ?? '')" @commit="emit('commit')" />
    </FieldShell>
    <NumberInput
        v-else-if="control.kind === 'number'"
        :model-value="control.value"
        :label="label"
        :min="control.field.min"
        :max="control.field.max"
        :step="control.field.step"
        @update:model-value="update($event ?? undefined)"
        @commit="emit('commit')"
    />
    <Toggle v-else-if="control.kind === 'toggle'" :model-value="control.value" :label="label" @update:model-value="update($event === true)" @commit="emit('commit')" />
    <FieldShell v-else-if="control.kind === 'choice'" :id="id" :label="label">
        <SelectInput
            :id="id"
            :model-value="control.value"
            :options="control.field.options.map((option) => ({ value: option.value, label: editor.i18n.localized(option.label) }))"
            @update:model-value="update($event ?? undefined)"
            @commit="emit('commit')"
        />
    </FieldShell>
    <ImageField v-else-if="control.kind === 'image'" :model-value="control.value" :label="label" url @update:model-value="update($event ?? null)" @commit="emit('commit')" />
    <FieldShell v-else :label="label">
        <ActionPicker :model-value="control.value" :label="label" @update:model-value="update($event)" @commit="emit('commit')" />
    </FieldShell>
</template>
