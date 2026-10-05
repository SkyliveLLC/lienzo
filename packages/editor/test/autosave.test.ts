import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Failure } from '../src/client.ts';
import { createAutosave, type Outcome } from '../src/state/autosave.ts';

describe('autosave', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function setup(outcomes: Outcome[] = []) {
        let value = 'v0';
        const sent: string[] = [];
        const autosave = createAutosave({
            read: () => value,
            save: async (snapshot) => {
                sent.push(snapshot);

                return outcomes.shift() ?? { ok: true };
            },
            delay: 1500,
        });

        return { autosave, sent, edit: (next: string) => { value = next; autosave.changed(); } };
    }

    const failure = (value: Failure): Outcome => ({ ok: false, failure: value });

    it('saves once, 1.5s after the last change', async () => {
        const { autosave, sent, edit } = setup();
        edit('v1');
        await vi.advanceTimersByTimeAsync(1000);
        edit('v2');
        await vi.advanceTimersByTimeAsync(1499);

        expect(sent).toEqual([]);
        expect(autosave.state.value.kind).toBe('pending');

        await vi.advanceTimersByTimeAsync(1);

        expect(sent).toEqual(['v2']);
        expect(autosave.state.value.kind).toBe('saved');
    });

    it('does not save a change that was undone', async () => {
        const { autosave, sent, edit } = setup();
        edit('v1');
        edit('v0');
        await vi.advanceTimersByTimeAsync(2000);

        expect(sent).toEqual([]);
        expect(autosave.state.value.kind).toBe('saved');
    });

    it('stops for good on a conflict', async () => {
        const { autosave, sent, edit } = setup([failure({ kind: 'conflict', message: 'stale', revision: 7 })]);
        edit('v1');
        await vi.advanceTimersByTimeAsync(1500);

        expect(autosave.state.value).toEqual({ kind: 'conflict' });

        edit('v2');
        await vi.advanceTimersByTimeAsync(5000);

        expect(sent).toEqual(['v1']);
    });

    it('retries by itself when offline, then saves the latest draft', async () => {
        const { autosave, sent, edit } = setup([failure({ kind: 'offline' })]);
        edit('v1');
        await vi.advanceTimersByTimeAsync(1500);

        expect(autosave.state.value.kind).toBe('offline');

        edit('v2');
        await vi.advanceTimersByTimeAsync(5000);

        expect(sent).toEqual(['v1', 'v2']);
        expect(autosave.state.value.kind).toBe('saved');
    });

    it('keeps the issues of a rejected draft and tries again on the next change', async () => {
        const issues = [{ path: 'draft.sections.0.height.desktop', code: 'range' as const, message: 'Too small' }];
        const { autosave, sent, edit } = setup([failure({ kind: 'invalid', message: 'Invalid', issues })]);
        edit('v1');
        await vi.advanceTimersByTimeAsync(1500);

        expect(autosave.state.value).toEqual({ kind: 'invalid', issues, message: 'Invalid' });

        edit('v2');
        await vi.advanceTimersByTimeAsync(1500);

        expect(sent).toEqual(['v1', 'v2']);
        expect(autosave.state.value.kind).toBe('saved');
    });

    it('saves a change made during a save right after it', async () => {
        let release: (outcome: Outcome) => void = () => undefined;
        let value = 'v0';
        const sent: string[] = [];
        const autosave = createAutosave({
            read: () => value,
            save: (snapshot) => {
                sent.push(snapshot);

                return sent.length === 1 ? new Promise((resolve) => (release = resolve)) : Promise.resolve({ ok: true });
            },
        });
        value = 'v1';
        autosave.changed();
        await vi.advanceTimersByTimeAsync(1500);
        value = 'v2';
        autosave.changed();
        release({ ok: true });
        await vi.advanceTimersByTimeAsync(1500);

        expect(sent).toEqual(['v1', 'v2']);
    });

    it('ignores a save that was in flight when it started over', async () => {
        let release: (outcome: Outcome) => void = () => undefined;
        let value = 'a1';
        const autosave = createAutosave({ read: () => value, save: () => new Promise((resolve) => (release = resolve)) });
        value = 'a2';
        autosave.changed();
        await vi.advanceTimersByTimeAsync(1500);

        // Another page loads while the old one is still saving.
        value = 'b1';
        autosave.reset();
        release({ ok: false, failure: { kind: 'conflict', message: 'stale', revision: 3 } });
        await vi.advanceTimersByTimeAsync(0);

        expect(autosave.state.value).toEqual({ kind: 'saved', at: null });
    });

    it('flush resolves only when everything is saved', async () => {
        const { autosave, edit } = setup([failure({ kind: 'http', status: 500, message: 'Boom' })]);
        edit('v1');

        expect(await autosave.flush()).toBe(false);
        expect(autosave.state.value).toEqual({ kind: 'failed', message: 'Boom' });
        expect(await autosave.flush()).toBe(true);
    });
});
