<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ALIGNMENTS } from '../model/geometry.ts';
import { useEditor } from '../state/editor.ts';

/**
 * The menu a right click opens on the canvas. It carries the actions that
 * apply to what is selected, so the right panel keeps only the settings of
 * the element.
 */
const props = defineProps<{ at: { x: number; y: number } }>();
const emit = defineEmits<{ close: [] }>();

const editor = useEditor();
const t = editor.t;
const menu = ref<HTMLElement>();
const position = ref({ ...props.at });

const selection = computed(() => editor.selectedElements.value);
const many = computed(() => selection.value.length > 1);
const grouped = computed(() => selection.value.some((element) => element.group));
const locked = computed(() => selection.value.some((element) => element.locked));

function run(action: () => void) {
    action();
    emit('close');
}

/** Keeps the menu inside the window, like any native one. */
async function place() {
    await nextTick();
    const box = menu.value?.getBoundingClientRect();

    if (!box) {
        return;
    }

    position.value = {
        x: Math.min(props.at.x, window.innerWidth - box.width - 8),
        y: Math.min(props.at.y, window.innerHeight - box.height - 8),
    };
}

watch(() => props.at, place, { immediate: true });

function onPointerDown(event: PointerEvent) {
    if (!menu.value?.contains(event.target as Node)) {
        emit('close');
    }
}

const onKey = (event: KeyboardEvent) => event.key === 'Escape' && emit('close');

onMounted(() => {
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', () => emit('close'));
    menu.value?.focus();
});

onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('keydown', onKey);
});
</script>

<template>
    <div
        ref="menu"
        class="lze-context"
        role="menu"
        tabindex="-1"
        :style="{ left: `${position.x}px`, top: `${position.y}px` }"
        @contextmenu.prevent
    >
        <template v-if="selection.length">
            <button type="button" role="menuitem" @click="run(editor.copySelected)">
                {{ t('menu.copy') }}<kbd>⌘C</kbd>
            </button>
            <button type="button" role="menuitem" @click="run(editor.duplicateSelected)">
                {{ t('common.duplicate') }}<kbd>⌘D</kbd>
            </button>
            <button type="button" role="menuitem" @click="run(editor.paste)">
                {{ t('menu.paste') }}<kbd>⌘V</kbd>
            </button>

            <hr />

            <button type="button" role="menuitem" @click="run(() => editor.layer('front'))">{{ t('canvas.front') }}</button>
            <button type="button" role="menuitem" @click="run(() => editor.layer('back'))">{{ t('canvas.back') }}</button>

            <hr />

            <button v-if="many" type="button" role="menuitem" @click="run(editor.groupSelected)">
                {{ t('multi.group') }}<kbd>⌘G</kbd>
            </button>
            <button v-if="grouped" type="button" role="menuitem" @click="run(editor.ungroupSelected)">
                {{ t('multi.ungroup') }}
            </button>
            <button type="button" role="menuitem" @click="run(editor.toggleLock)">
                {{ locked ? t('menu.unlock') : t('menu.lock') }}
            </button>

            <template v-if="many">
                <hr />
                <p class="lze-context-label">{{ t('multi.align') }}</p>
                <div class="lze-context-row">
                    <button
                        v-for="where in ALIGNMENTS"
                        :key="where"
                        type="button"
                        role="menuitem"
                        :title="t(`align.${where}`)"
                        :aria-label="t(`align.${where}`)"
                        @click="run(() => editor.align(where))"
                    >
                        <span class="lze-context-align" :data-align="where" aria-hidden="true" />
                    </button>
                </div>
                <template v-if="selection.length > 2">
                    <button type="button" role="menuitem" @click="run(() => editor.distributeSelected('x'))">{{ t('multi.distributeX') }}</button>
                    <button type="button" role="menuitem" @click="run(() => editor.distributeSelected('y'))">{{ t('multi.distributeY') }}</button>
                </template>
            </template>

            <hr />

            <button type="button" role="menuitem" class="lze-context-danger" @click="run(editor.removeSelected)">
                {{ t('common.delete') }}<kbd>⌫</kbd>
            </button>
        </template>

        <template v-else>
            <button type="button" role="menuitem" @click="run(editor.paste)">
                {{ t('menu.paste') }}<kbd>⌘V</kbd>
            </button>
            <button type="button" role="menuitem" @click="run(() => (editor.state.zoom = null))">{{ t('zoom.fit') }}</button>
            <button type="button" role="menuitem" @click="run(() => (editor.state.zoom = 1))">{{ t('zoom.actual') }}</button>
        </template>
    </div>
</template>
