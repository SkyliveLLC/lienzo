<script setup lang="ts">
import type { CoreElement } from '@skylivellc/lienzo-core';
import { computed } from 'vue';
import { useEditor } from '../../state/editor.ts';
import Button from '../../ui/Button.vue';
import TextInput from '../../ui/TextInput.vue';
import Toggle from '../../ui/Toggle.vue';

const MAX_ROWS = 40;
const MAX_COLUMNS = 8;

/** A table is rows of plain cells; the first one can name the columns. */
const props = defineProps<{ element: CoreElement }>();
const editor = useEditor();
const t = editor.t;
const rows = computed(() => props.element.props.rows ?? []);
const columns = computed(() => Math.max(1, ...rows.value.map((row) => row.length)));

function set(row: number, column: number, value: string) {
    props.element.props.rows = rows.value.map((cells, at) => (at === row
        ? cells.map((cell, position) => (position === column ? value : cell))
        : cells));
}

function addRow() {
    props.element.props.rows = [...rows.value, Array.from({ length: columns.value }, () => '')];
    editor.commit();
}

function addColumn() {
    props.element.props.rows = rows.value.map((cells) => [...cells, '']);
    editor.commit();
}

function removeRow(index: number) {
    props.element.props.rows = rows.value.filter((_, at) => at !== index);
    editor.commit();
}

function removeColumn() {
    props.element.props.rows = rows.value.map((cells) => cells.slice(0, -1));
    editor.commit();
}
</script>

<template>
    <Toggle :model-value="element.props.header !== false" :label="t('el.tableHeader')" @update:model-value="element.props.header = $event; editor.commit()" />
    <div class="lze-field">
        <span class="lze-label">{{ t('el.tableCells') }}</span>
        <div v-for="(cells, row) in rows" :key="row" class="lze-card">
            <div class="lze-grid-2">
                <TextInput
                    v-for="(cell, column) in cells"
                    :key="column"
                    :model-value="cell"
                    :label="t('el.tableCell', { row: row + 1, column: column + 1 })"
                    :maxlength="300"
                    @update:model-value="set(row, column, $event ?? '')"
                    @commit="editor.commit()"
                />
            </div>
            <Button variant="danger" @click="removeRow(row)">{{ t('el.tableRemoveRow') }}</Button>
        </div>
        <div class="lze-row">
            <Button :disabled="rows.length >= MAX_ROWS" @click="addRow">{{ t('el.tableAddRow') }}</Button>
            <Button :disabled="columns >= MAX_COLUMNS || rows.length === 0" @click="addColumn">{{ t('el.tableAddColumn') }}</Button>
            <Button v-if="columns > 1" variant="ghost" @click="removeColumn">{{ t('el.tableRemoveColumn') }}</Button>
        </div>
        <p v-if="rows.length === 0" class="lze-hint">{{ t('el.tableEmpty') }}</p>
    </div>
</template>
