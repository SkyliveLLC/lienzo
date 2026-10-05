<script setup lang="ts">
import { ref } from 'vue';
import DesignPanel from '../panels/DesignPanel.vue';
import PagePanel from '../panels/PagePanel.vue';
import { useEditor } from '../state/editor.ts';

/** Right sidebar: settings of what is selected, or of the page. */
const editor = useEditor();
const tab = ref<'design' | 'page'>('design');
</script>

<template>
    <aside class="lze-sidebar lze-right">
        <div class="lze-tabs" role="tablist">
            <button type="button" role="tab" :aria-selected="tab === 'design'" @click="tab = 'design'">{{ editor.t('panel.design') }}</button>
            <button type="button" role="tab" :aria-selected="tab === 'page'" @click="tab = 'page'">{{ editor.t('panel.page') }}</button>
        </div>
        <div class="lze-scroll lze-pad" role="tabpanel">
            <DesignPanel v-if="tab === 'design'" />
            <PagePanel v-else />
        </div>
    </aside>
</template>
