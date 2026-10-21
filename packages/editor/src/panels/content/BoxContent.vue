<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import NumberInput from '../../ui/NumberInput.vue';
import SelectInput from '../../ui/SelectInput.vue';

/** A box says how it lays out what it holds; the elements inside have no places of their own. */
const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const ids = { flow: useId(), align: useId() };
const flows = (['column', 'row'] as const).map((value) => ({ value, label: t(`el.boxFlow.${value}`) }));
const aligns = (['start', 'center', 'end', 'between'] as const).map((value) => ({ value, label: t(`section.align.${value}`) }));
const count = () => props.element.children?.length ?? 0;
</script>

<template>
    <Field :id="ids.flow" :label="t('el.boxFlow')">
        <SelectInput :id="ids.flow" :model-value="element.props.flow ?? 'column'" :options="flows" @update:model-value="element.props.flow = $event" @commit="editor.commit()" />
    </Field>
    <NumberInput
        :model-value="element.props.flow_gap ?? 16"
        :label="t('section.flowGap')"
        :min="0"
        :max="160"
        suffix="px"
        @update:model-value="element.props.flow_gap = $event ?? 16"
        @commit="editor.commit()"
    />
    <Field :id="ids.align" :label="t('section.flowAlign')">
        <SelectInput :id="ids.align" :model-value="element.props.flow_align ?? 'start'" :options="aligns" @update:model-value="element.props.flow_align = $event" @commit="editor.commit()" />
    </Field>
    <p class="lze-hint">{{ count() === 0 ? t('el.boxEmpty') : t('el.boxHolds', { n: count() }) }}</p>
</template>
