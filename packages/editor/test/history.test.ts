import { describe, expect, it } from 'vitest';
import { createHistory } from '../src/model/history.ts';

describe('history', () => {
    it('undoes and redoes in order', () => {
        const history = createHistory('a');
        history.push('b');
        history.push('c');

        expect(history.undo()).toBe('b');
        expect(history.undo()).toBe('a');
        expect(history.undo()).toBeNull();
        expect(history.redo()).toBe('b');
    });

    it('ignores a snapshot equal to the current one', () => {
        const history = createHistory('a');

        expect(history.push('a')).toBe(false);
        expect(history.canUndo).toBe(false);
    });

    it('drops the redo branch on a new edit', () => {
        const history = createHistory('a');
        history.push('b');
        history.undo();
        history.push('c');

        expect(history.canRedo).toBe(false);
        expect(history.undo()).toBe('a');
    });

    it('keeps only the latest entries', () => {
        const history = createHistory('0', 3);
        ['1', '2', '3', '4'].forEach((snapshot) => history.push(snapshot));

        expect(history.undo()).toBe('3');
        expect(history.undo()).toBe('2');
        expect(history.undo()).toBeNull();
    });
});
