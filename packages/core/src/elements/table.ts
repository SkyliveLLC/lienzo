import { h, text } from '../html.ts';
import type { ElementRenderer } from './context.ts';

/**
 * A table of plain cells: prices, hours, whatever comes in rows. With
 * `header` on, the first row names the columns and the browser treats it as
 * such, which is what a screen reader reads back.
 */
export const table: ElementRenderer = (element) => {
    const rows = element.props.rows ?? [];
    const header = element.props.header !== false && rows.length > 0;
    const cells = (row: readonly string[], tag: 'th' | 'td') =>
        row.map((cell) => h(tag, tag === 'th' ? { scope: 'col' } : {}, [text(cell)]));

    return {
        tag: 'table',
        class: 'lz-table',
        children: [
            header && rows[0] ? h('thead', {}, [h('tr', {}, cells(rows[0], 'th'))]) : null,
            h('tbody', {}, rows.slice(header ? 1 : 0).map((row) => h('tr', {}, cells(row, 'td')))),
        ],
    };
};
