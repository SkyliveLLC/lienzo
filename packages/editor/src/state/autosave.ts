import type { Issue } from '@skylive/lienzo-core';
import { shallowRef, type ShallowRef } from 'vue';
import type { Failure } from '../client.ts';

/** Where the draft stands against the server. Exactly one of these at a time. */
export type SaveState =
    | { kind: 'saved'; at: Date | null }
    | { kind: 'pending' }
    | { kind: 'saving' }
    /** The network is down; retries on its own. */
    | { kind: 'offline' }
    /** The server failed; retries on the next change or on demand. */
    | { kind: 'failed'; message: string }
    /** The server rejected some values; retries on the next change. */
    | { kind: 'invalid'; issues: Issue[]; message: string }
    /** Someone else saved first. Nothing is saved again until the page reloads. */
    | { kind: 'conflict' };

export type Outcome = { ok: true } | { ok: false; failure: Failure };

export type AutosaveOptions<T> = {
    /** A detached copy of everything autosaved, as plain data. */
    read(): T;
    /** Sends a copy taken by `read`. */
    save(value: T): Promise<Outcome>;
    delay?: number;
    offlineRetry?: number;
};

export type Autosave = {
    readonly state: ShallowRef<SaveState>;
    /** Something may have changed: saves `delay` ms after the last call, if the snapshot differs from the saved one. */
    changed(): void;
    /** Saves now and waits. True when everything is saved. */
    flush(): Promise<boolean>;
    /** Flushes, then runs `task` while no autosave can start, so writes never interleave. */
    exclusive<T>(task: () => Promise<T>): Promise<T>;
    /** Starts over from what `read` gives now, known to be on the server (after a load or a reload). A save still in flight no longer counts. */
    reset(): void;
    dispose(): void;
};

/**
 * Debounced saving with one write in flight at a time. A change during a
 * save is saved right after it. A failure keeps the draft and says why;
 * offline retries every few seconds, a conflict stops for good.
 */
export function createAutosave<T>({ read, save, delay = 1500, offlineRetry = 5000 }: AutosaveOptions<T>): Autosave {
    const state = shallowRef<SaveState>({ kind: 'saved', at: null });
    const key = () => JSON.stringify(read());
    let saved = key();
    /** Bumped by `reset`, so the outcome of a save sent before it is ignored. */
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running: Promise<unknown> | null = null;

    const schedule = (wait: number) => {
        clearTimeout(timer);
        timer = setTimeout(() => void run(), wait);
    };

    async function run(): Promise<boolean> {
        clearTimeout(timer);

        while (running) {
            await running;
        }

        if (state.value.kind === 'conflict') {
            return false;
        }

        const value = read();
        const snapshot = JSON.stringify(value);

        if (snapshot === saved) {
            if (state.value.kind !== 'saved') {
                state.value = { kind: 'saved', at: new Date() };
            }

            return true;
        }

        state.value = { kind: 'saving' };
        const sentIn = generation;
        const attempt = save(value);
        running = attempt;
        const outcome = await attempt.finally(() => {
            running = null;
        });

        if (sentIn !== generation) {
            return false;
        }

        if (outcome.ok) {
            saved = snapshot;

            if (key() === saved) {
                state.value = { kind: 'saved', at: new Date() };

                return true;
            }

            state.value = { kind: 'pending' };
            schedule(delay);

            return false;
        }

        state.value = failed(outcome.failure);

        if (state.value.kind === 'offline') {
            schedule(offlineRetry);
        }

        return false;
    }

    const online = () => {
        if (state.value.kind === 'offline') {
            void run();
        }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener('online', online);
    }

    return {
        state,
        changed() {
            if (state.value.kind === 'conflict' || state.value.kind === 'saving') {
                return;
            }

            if (key() === saved) {
                clearTimeout(timer);
                if (state.value.kind !== 'saved') {
                    state.value = { kind: 'saved', at: new Date() };
                }

                return;
            }

            if (state.value.kind !== 'offline') {
                state.value = { kind: 'pending' };
            }
            schedule(delay);
        },
        flush: run,
        async exclusive(task) {
            await run();

            while (running) {
                await running;
            }

            const work = task();
            running = work;

            try {
                return await work;
            } finally {
                running = null;
            }
        },
        reset() {
            clearTimeout(timer);
            generation++;
            saved = key();
            state.value = { kind: 'saved', at: null };
        },
        dispose() {
            clearTimeout(timer);
            if (typeof window !== 'undefined') {
                window.removeEventListener('online', online);
            }
        },
    };
}

function failed(failure: Failure): SaveState {
    switch (failure.kind) {
        case 'offline':
            return { kind: 'offline' };
        case 'conflict':
            return { kind: 'conflict' };
        case 'invalid':
            return { kind: 'invalid', issues: failure.issues, message: failure.message };
        case 'http':
            return { kind: 'failed', message: failure.message };
    }
}
