<script setup lang="ts">
import { computed } from 'vue';
import { isThemeToken, swatch, THEME_TOKENS } from '../model/theme.ts';
import { useEditor } from '../state/editor.ts';

/**
 * Picking a theme color keeps it linked: when the palette changes, the page
 * follows. A custom hex is the way out, not the way in.
 */
const model = defineModel<string | null | undefined>({ required: true });
defineProps<{ label: string }>();
const emit = defineEmits<{ commit: [] }>();
const editor = useEditor();
const custom = computed(() => (model.value && !isThemeToken(model.value) ? model.value : '#2563eb'));

function pick(value: string) {
    model.value = value;
    emit('commit');
}
</script>

<template>
    <div class="lze-field">
        <span class="lze-label">{{ label }}</span>
        <div class="lze-swatches" role="group" :aria-label="label">
            <button
                v-for="token in THEME_TOKENS"
                :key="token"
                type="button"
                class="lze-swatch"
                :style="{ background: swatch(token, editor.theme.value) }"
                :title="editor.t(`token.${token}`)"
                :aria-label="editor.t(`token.${token}`)"
                :aria-pressed="model === token"
                @click="pick(token)"
            />
            <label class="lze-swatch-custom" :data-active="!!model && !isThemeToken(model)" :title="editor.t('color.custom')">
                <input type="color" :value="custom" :aria-label="editor.t('color.customLabel', { label })" @input="model = ($event.target as HTMLInputElement).value" @change="emit('commit')" />
                {{ editor.t('color.custom') }}
            </label>
        </div>
    </div>
</template>
