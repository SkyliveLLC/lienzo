<script setup lang="ts">
import { computed } from 'vue';
import { useEditor } from '../state/editor.ts';
import Button from '../ui/Button.vue';
import Dialog from '../ui/Dialog.vue';

/** Published versions of the open page, newest first as the backend sends them. */
const editor = useEditor();
const t = editor.t;
const open = editor.dialogModel('versions');
const versions = computed(() => editor.state.page?.versions ?? []);
const date = new Intl.DateTimeFormat(editor.i18n.locale, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<template>
    <Dialog v-model:open="open" :title="t('versions.title')" :description="t('versions.description')" size="lg">
        <ul v-if="versions.length > 0" class="lze-rows">
            <li v-for="version in versions" :key="version.id" class="lze-row-item">
                <div>
                    <p>{{ date.format(new Date(version.createdAt)) }}</p>
                    <p v-if="version.by" class="lze-hint">{{ t('versions.by', { name: version.by }) }}</p>
                </div>
                <Button @click="editor.restoreVersion(version.id)">{{ t('versions.restore') }}</Button>
            </li>
        </ul>
        <p v-else class="lze-hint">{{ t('versions.empty') }}</p>
    </Dialog>
</template>
