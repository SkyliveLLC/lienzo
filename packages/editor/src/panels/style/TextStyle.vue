<script setup lang="ts">
import type { Element } from '@skylivellc/lienzo-core';
import { AlignCenter, AlignLeft, AlignRight } from '@lucide/vue';
import { useEditor } from '../../state/editor.ts';
import IconButton from '../../ui/IconButton.vue';
import NumberInput from '../../ui/NumberInput.vue';
import PanelSection from '../../ui/PanelSection.vue';
import SelectInput from '../../ui/SelectInput.vue';
import Toggle from '../../ui/Toggle.vue';

const props = defineProps<{ element: Element }>();
const editor = useEditor();
const t = editor.t;

const fonts = [{ value: 'heading', label: 'style.fontHeading' }, { value: 'body', label: 'style.fontBody' }] as const;
const aligns = [
    { value: 'left', label: 'style.align.left', icon: AlignLeft },
    { value: 'center', label: 'style.align.center', icon: AlignCenter },
    { value: 'right', label: 'style.align.right', icon: AlignRight },
] as const;
const weights = ([300, 400, 500, 600, 700, 800] as const).map((weight) => ({ value: weight, label: t(`style.weight.${weight}`) }));
const cases = (['none', 'upper', 'lower', 'title'] as const).map((value) => ({ value, label: t(`style.case.${value}`) }));
const faces = (['solid', 'outline', 'glow'] as const).map((value) => ({ value, label: t(`style.face.${value}`) }));

function set<K extends 'font' | 'align'>(key: K, value: Element['style'][K]) {
    props.element.style[key] = value;
    editor.commit();
}
</script>

<template>
    <PanelSection :title="t('style.text')">
        <div class="lze-tabs-inline" role="group" :aria-label="t('style.font')">
            <button
                v-for="font in fonts"
                :key="font.value"
                type="button"
                :aria-pressed="(element.style.font ?? 'body') === font.value"
                @click="set('font', font.value)"
            >
                {{ t(font.label) }}
            </button>
        </div>
        <div class="lze-grid-2">
            <NumberInput v-model="element.style.size" :label="t('style.size')" :min="8" :max="240" suffix="px" @commit="editor.commit()" />
            <SelectInput v-model="element.style.weight" :options="weights" :label="t('style.weight')" :placeholder="t('style.weight')" @commit="editor.commit()" />
        </div>
        <div class="lze-grid-2">
            <NumberInput
                v-model="element.style.size_mobile"
                :label="t('style.sizeMobile')"
                :min="8"
                :max="240"
                suffix="px"
                :placeholder="String(element.style.size ?? '')"
                @commit="editor.commit()"
            />
            <NumberInput v-model="element.style.tracking" :label="t('style.tracking')" :min="-0.05" :max="0.5" :step="0.01" @commit="editor.commit()" />
        </div>
        <div class="lze-grid-2">
            <SelectInput v-model="element.style.text_case" :options="cases" :label="t('style.case')" @commit="editor.commit()" />
            <SelectInput v-model="element.style.text_style" :options="faces" :label="t('style.face')" @commit="editor.commit()" />
        </div>
        <div class="lze-row">
            <div class="lze-row" role="group" :aria-label="t('style.align')">
                <IconButton
                    v-for="align in aligns"
                    :key="align.value"
                    :label="t(align.label)"
                    :active="(element.style.align ?? 'left') === align.value"
                    @click="set('align', align.value)"
                >
                    <component :is="align.icon" :size="16" aria-hidden="true" />
                </IconButton>
            </div>
            <NumberInput v-model="element.style.line_height" class="lze-grow" :label="t('style.lineHeight')" :min="0.8" :max="3" :step="0.05" @commit="editor.commit()" />
        </div>
        <Toggle v-model="element.style.auto_height" :label="t('style.autoHeight')" @commit="editor.commit()" />
        <p class="lze-hint">{{ t('style.autoHeightHint') }}</p>
    </PanelSection>
</template>
