<script setup lang="ts">
import { computed } from 'vue';
import { useEditor } from '../state/editor.ts';
import Button from './Button.vue';
import TextInput from './TextInput.vue';

/**
 * An image reference (`media:<id>` from the library, or an https URL) with a
 * thumbnail, a library picker and a remove button. `url` adds a field to paste an address.
 */
const model = defineModel<string | null | undefined>({ required: true });
const props = withDefaults(defineProps<{ label: string; url?: boolean; choose?: string; thumb?: 'wide' | 'icon' }>(), { url: false, choose: undefined, thumb: 'wide' });
const emit = defineEmits<{ commit: [] }>();
const editor = useEditor();

const preview = computed(() => {
    const value = model.value;

    if (!value) {
        return null;
    }

    return value.startsWith('media:') ? (editor.state.workspace.assets.find((asset) => asset.ref === value)?.thumb ?? null) : value;
});

/** The address field shows pasted URLs only; a library pick is shown by its thumbnail. */
const address = computed(() => (model.value && !model.value.startsWith('media:') ? model.value : ''));

function pick() {
    editor.openLibrary((ref) => {
        model.value = ref;
        emit('commit');
    });
}

function remove() {
    model.value = null;
    emit('commit');
}
</script>

<template>
    <div class="lze-field" role="group" :aria-label="props.label">
        <span class="lze-label">{{ props.label }}</span>
        <div v-if="preview" class="lze-image-preview" :data-thumb="thumb"><img :src="preview" alt="" /></div>
        <div class="lze-row">
            <Button @click="pick">{{ choose ?? editor.t('el.chooseFromLibrary') }}</Button>
            <Button v-if="model" variant="ghost" @click="remove">{{ editor.t('common.remove') }}</Button>
        </div>
        <TextInput
            v-if="url"
            :model-value="address"
            type="url"
            :maxlength="500"
            :placeholder="editor.t('el.imageUrl')"
            :label="editor.t('el.imageUrl')"
            @update:model-value="model = $event"
            @commit="emit('commit')"
        />
    </div>
</template>
