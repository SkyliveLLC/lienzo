<script setup lang="ts">
import type { Asset } from '@skylivellc/lienzo-core/protocol';
import { Trash2, Upload } from '@lucide/vue';
import { computed, ref } from 'vue';
import { useEditor } from '../state/editor.ts';
import Dialog from '../ui/Dialog.vue';
import IconButton from '../ui/IconButton.vue';

/**
 * The site's images: upload, pick and delete. Opened by whoever needs an
 * image (`state.library.onPick`); opened on its own, picking adds an image element.
 */
const editor = useEditor();
const t = editor.t;
const input = ref<HTMLInputElement>();
const uploading = ref(false);

const open = computed({
    get: () => editor.state.library !== null,
    set: (value) => {
        if (!value) {
            editor.state.library = null;
        }
    },
});

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/** Bytes in the largest unit that keeps the number at or above 1, in the editor's language. */
function bytes(value: number): string {
    const step = Math.min(UNITS.length - 1, Math.max(0, Math.floor(Math.log(Math.max(value, 1)) / Math.log(1024))));

    return new Intl.NumberFormat(editor.i18n.locale, { style: 'unit', unit: UNITS[step], unitDisplay: 'short', maximumFractionDigits: 1 }).format(value / 1024 ** step);
}

const quota = computed(() => {
    const { used, limit } = editor.state.workspace.quota;

    return limit > 0 ? t('library.quota', { used: bytes(used), limit: bytes(limit) }) : null;
});

async function upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (!file) {
        return;
    }

    uploading.value = true;
    await editor.uploadAsset(file);
    uploading.value = false;

    if (input.value) {
        input.value.value = '';
    }
}

function use(asset: Asset) {
    const onPick = editor.state.library?.onPick;

    if (onPick) {
        onPick(asset.ref);
    } else {
        editor.addElement({ kind: 'core', type: 'image' }, undefined, asset.ref);
    }

    open.value = false;
}
</script>

<template>
    <Dialog v-model:open="open" :title="t('library.title')" :description="t('library.description')" size="lg">
        <div class="lze-asset-grid">
            <button type="button" class="lze-upload-tile" :disabled="uploading" @click="input?.click()">
                <Upload :size="20" aria-hidden="true" />
                <strong>{{ uploading ? t('library.uploading') : t('library.upload') }}</strong>
                <span class="lze-hint">{{ t('library.formats') }}</span>
            </button>
            <input ref="input" type="file" class="lze-file-input" tabindex="-1" aria-hidden="true" accept=".jpg,.jpeg,.png,.webp,.avif,.svg" @change="upload" />
            <figure v-for="asset in editor.state.workspace.assets" :key="asset.id" class="lze-asset">
                <button type="button" class="lze-asset-use" :aria-label="t('library.use', { name: asset.name })" @click="use(asset)">
                    <img :src="asset.thumb" :alt="asset.name" loading="lazy" />
                    <figcaption>{{ asset.name }}</figcaption>
                </button>
                <IconButton class="lze-asset-delete" tone="danger" :label="t('library.delete', { name: asset.name })" @click="editor.deleteAsset(asset)">
                    <Trash2 :size="14" aria-hidden="true" />
                </IconButton>
            </figure>
        </div>
        <p v-if="editor.state.workspace.assets.length === 0" class="lze-hint">{{ t('media.empty') }}</p>
        <p v-if="quota" class="lze-hint">{{ quota }}</p>
    </Dialog>
</template>
