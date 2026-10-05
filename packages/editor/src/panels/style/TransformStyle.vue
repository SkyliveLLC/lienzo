<script setup lang="ts">
import type { Element } from '@skylivellc/lienzo-core';
import { FoldHorizontal, FoldVertical, RotateCcw } from '@lucide/vue';
import { useId } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Field from '../../ui/Field.vue';
import IconButton from '../../ui/IconButton.vue';
import NumberInput from '../../ui/NumberInput.vue';
import PanelSection from '../../ui/PanelSection.vue';
import SelectInput from '../../ui/SelectInput.vue';

const props = defineProps<{ element: Element }>();
const editor = useEditor();
const t = editor.t;
const ids = { overflow: useId(), visible: useId() };

const overflows = (['visible', 'hidden', 'scroll-x', 'scroll-y'] as const).map((value) => ({ value, label: t(`style.overflow.${value}`) }));
const devices = (['all', 'desktop', 'mobile'] as const).map((value) => ({ value, label: t(`style.visible.${value}`) }));

function set<K extends 'rotate' | 'flip_x' | 'flip_y'>(key: K, value: Element['style'][K]) {
    props.element.style[key] = value;
    editor.commit();
}
</script>

<template>
    <PanelSection :title="t('style.transform')" :open="false">
        <div class="lze-row">
            <NumberInput v-model="element.style.rotate" class="lze-grow" :label="t('style.rotate')" :min="-180" :max="180" suffix="°" @commit="editor.commit()" />
            <IconButton :label="t('style.straighten')" @click="set('rotate', 0)"><RotateCcw :size="16" aria-hidden="true" /></IconButton>
            <IconButton :label="t('style.flipX')" :active="element.style.flip_x === true" @click="set('flip_x', !element.style.flip_x)">
                <FoldHorizontal :size="16" aria-hidden="true" />
            </IconButton>
            <IconButton :label="t('style.flipY')" :active="element.style.flip_y === true" @click="set('flip_y', !element.style.flip_y)">
                <FoldVertical :size="16" aria-hidden="true" />
            </IconButton>
        </div>
        <div class="lze-grid-2">
            <Field :id="ids.overflow" :label="t('style.overflow')">
                <SelectInput
                    :id="ids.overflow"
                    :model-value="element.style.overflow ?? (element.style.clip ? 'hidden' : 'visible')"
                    :options="overflows"
                    @update:model-value="element.style.overflow = $event"
                    @commit="editor.commit()"
                />
            </Field>
            <Field :id="ids.visible" :label="t('style.visibleOn')">
                <SelectInput
                    :id="ids.visible"
                    :model-value="element.style.visible_on ?? 'all'"
                    :options="devices"
                    @update:model-value="element.style.visible_on = $event"
                    @commit="editor.commit()"
                />
            </Field>
        </div>
        <p class="lze-hint">{{ t('style.transformHint') }}</p>
    </PanelSection>
</template>
