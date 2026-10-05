<script setup lang="ts">
import type { Modal } from '@skylive/lienzo-core';
import { useId } from 'vue';
import { MODAL_SIZES, useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import ColorPicker from '../ui/ColorPicker.vue';
import Field from '../ui/Field.vue';
import NumberInput from '../ui/NumberInput.vue';
import TextInput from '../ui/TextInput.vue';
import Toggle from '../ui/Toggle.vue';

/** Settings of the modal being edited. */
const props = defineProps<{ modal: Modal }>();
const editor = useEditor();
const t = editor.t;
const id = useId();

function applySize(size: (typeof MODAL_SIZES)[number]) {
    props.modal.size = size.key;
    props.modal.width = size.width;
    editor.commit();
}

/** Typing a width leaves the presets. */
function setWidth(width: number | null | undefined) {
    if (typeof width === 'number') {
        props.modal.width = width;
        props.modal.size = 'custom';
    }
}
</script>

<template>
    <div class="lze-stack">
        <h2 class="lze-panel-title">{{ t('modal.heading') }}</h2>
        <Field :id="id" :label="t('modal.title')">
            <TextInput :id="id" v-model="modal.title" :maxlength="120" @commit="editor.commit()" />
            <Toggle v-model="modal.show_title" :label="t('modal.showTitle')" @commit="editor.commit()" />
            <p class="lze-hint">{{ t('modal.showTitleHint') }}</p>
        </Field>
        <div class="lze-field">
            <span class="lze-label">{{ t('modal.size') }}</span>
            <div class="lze-row" role="group" :aria-label="t('modal.size')">
                <Button
                    v-for="size in MODAL_SIZES"
                    :key="size.key"
                    :variant="modal.size === size.key ? 'primary' : 'outline'"
                    :aria-pressed="modal.size === size.key"
                    @click="applySize(size)"
                >
                    {{ t(`modal.size.${size.key}`) }}
                </Button>
            </div>
        </div>
        <div class="lze-field">
            <NumberInput
                :model-value="modal.width"
                :label="t('modal.width')"
                :min="280"
                :max="1200"
                suffix="px"
                :disabled="modal.size === 'full'"
                @update:model-value="setWidth"
                @commit="editor.commit()"
            />
            <p v-if="modal.size === 'full'" class="lze-hint">{{ t('modal.fullHint') }}</p>
        </div>
        <Button @click="editor.fitCanvas(modal)">{{ t('section.fitHeight') }}</Button>
        <div class="lze-field">
            <NumberInput
                :model-value="modal.height.desktop"
                :label="t('section.heightDesktop')"
                :min="80"
                :max="2000"
                @update:model-value="modal.height.desktop = $event ?? modal.height.desktop"
                @commit="editor.commit()"
            />
            <NumberInput
                :model-value="modal.height.mobile"
                :label="t('section.heightMobile')"
                :min="80"
                :max="2400"
                @update:model-value="modal.height.mobile = $event ?? modal.height.mobile"
                @commit="editor.commit()"
            />
        </div>
        <ColorPicker v-model="modal.background.color" :label="t('modal.background')" @commit="editor.commit()" />
        <Button @click="editor.openModal(null)">{{ t('canvas.backToPage') }}</Button>
    </div>
</template>
