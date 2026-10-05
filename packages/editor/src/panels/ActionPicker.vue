<script setup lang="ts">
import { CORE_ACTION_TYPES, type Action, type FieldValue } from '@skylive/lienzo-core';
import { computed, useId } from 'vue';
import { useEditor } from '../state/editor.ts';
import SelectInput from '../ui/SelectInput.vue';
import TextInput from '../ui/TextInput.vue';
import { CORE_ACTIONS, defaultActionValue, isCoreAction } from './actions.ts';
import FieldControl from './FieldControl.vue';

/**
 * What a click does: a core action or one the app registered, plus the value
 * it needs (a modal, a page, a number...). Used by buttons, menu links and
 * app fields of kind `action`. Emits a whole new action on every change.
 */
const props = defineProps<{ modelValue: Action | null | undefined; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [action: { type: string; value: string }]; commit: [] }>();
const editor = useEditor();
const t = editor.t;
const sections = useId();

const type = computed(() => props.modelValue?.type || 'none');
const value = computed(() => props.modelValue?.value ?? '');
const app = computed(() => editor.catalog.value.actions.find((spec) => spec.type === type.value) ?? null);
const control = computed(() => (isCoreAction(type.value) ? CORE_ACTIONS[type.value] : null));

/** Core actions first, then the app's; an action whose plugin is gone stays listed so it is not lost silently. */
const options = computed(() => {
    const list = [
        ...CORE_ACTION_TYPES.map((core) => ({ value: core, label: t(`action.${core}`) })),
        ...editor.catalog.value.actions.map((spec) => ({ value: spec.type, label: editor.i18n.localized(spec.label) })),
    ];

    return list.some((option) => option.value === type.value) ? list : [...list, { value: type.value, label: t('action.unknown', { type: type.value }) }];
});

const modals = computed(() => (editor.state.draft.modals ?? []).map((modal) => ({ value: modal.id, label: modal.title })));
// Core turns a page action into `/<slug>`; the home page has no slug, so it is written as `/`.
const pages = computed(() => editor.state.workspace.pages.map((page) => ({ value: page.slug || '/', label: page.slug ? `${page.title} /${page.slug}` : page.title })));

function setType(next: string) {
    const spec = editor.catalog.value.actions.find((candidate) => candidate.type === next);
    // Switching between core actions keeps the value: a number typed for WhatsApp also works to call.
    emit('update:modelValue', { type: next, value: spec ? defaultActionValue(spec.value) : value.value });
    emit('commit');
}

function setValue(next: FieldValue | undefined) {
    emit('update:modelValue', { type: type.value, value: next === null || next === undefined || typeof next === 'object' ? '' : String(next) });
}

/** App action values live in a string; the field control wants them in the field's own type. */
const appValue = computed((): FieldValue => {
    const field = app.value?.value;

    if (field?.kind === 'number') {
        return value.value === '' ? field.default : Number(value.value);
    }

    if (field?.kind === 'toggle') {
        return value.value === '' ? field.default : value.value === 'true';
    }

    return value.value;
});
</script>

<template>
    <div class="lze-field">
        <SelectInput :model-value="type" :options="options" :label="label" @update:model-value="setType(String($event ?? 'none'))" />
        <template v-if="control">
            <TextInput
                v-if="control.kind === 'text'"
                :model-value="value"
                :maxlength="300"
                :placeholder="t(control.placeholder)"
                :label="t('action.target')"
                @update:model-value="setValue($event)"
                @commit="emit('commit')"
            />
            <template v-else-if="control.kind === 'anchor'">
                <TextInput
                    :model-value="value"
                    :maxlength="300"
                    :placeholder="t('action.placeholder.anchor')"
                    :label="t('action.placeholder.anchor')"
                    :list="sections"
                    @update:model-value="setValue($event)"
                    @commit="emit('commit')"
                />
                <datalist :id="sections">
                    <option v-for="section in editor.state.draft.sections" :key="section.id" :value="section.id" />
                </datalist>
            </template>
            <SelectInput
                v-else-if="control.kind === 'modal'"
                :model-value="value"
                :options="modals"
                :label="t('action.chooseModal')"
                :placeholder="t('action.chooseModal')"
                @update:model-value="setValue($event)"
                @commit="emit('commit')"
            />
            <SelectInput
                v-else-if="control.kind === 'page'"
                :model-value="value"
                :options="pages"
                :label="t('action.choosePage')"
                :placeholder="t('action.choosePage')"
                @update:model-value="setValue($event)"
                @commit="emit('commit')"
            />
            <p v-else-if="control.kind === 'submit'" class="lze-hint">{{ t('action.submitHint') }}</p>
        </template>
        <FieldControl
            v-else-if="app?.value"
            :field="app.value"
            :model-value="appValue"
            @update:model-value="setValue($event)"
            @commit="emit('commit')"
        />
    </div>
</template>
