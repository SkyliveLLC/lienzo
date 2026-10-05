/**
 * Undo and redo over document snapshots (serialized JSON). Pushing a
 * snapshot equal to the current one is a no-op, so callers can push after
 * every gesture without checking whether anything changed.
 */
export type History = {
    /** Records a new state. Returns false when it equals the current one. */
    push(snapshot: string): boolean;
    /** The state to restore, or null at the edge of the history. */
    undo(): string | null;
    redo(): string | null;
    /** Forgets everything and starts again from `snapshot` (a page switch or a reload). */
    reset(snapshot: string): void;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
};

export function createHistory(initial: string, limit = 50): History {
    let entries = [initial];
    let cursor = 0;

    const move = (step: 1 | -1): string | null => {
        const next = cursor + step;

        if (next < 0 || next >= entries.length) {
            return null;
        }

        cursor = next;

        return entries[cursor] ?? null;
    };

    return {
        push(snapshot) {
            if (snapshot === entries[cursor]) {
                return false;
            }

            entries = [...entries.slice(0, cursor + 1), snapshot].slice(-limit);
            cursor = entries.length - 1;

            return true;
        },
        undo: () => move(-1),
        redo: () => move(1),
        reset(snapshot) {
            entries = [snapshot];
            cursor = 0;
        },
        get canUndo() {
            return cursor > 0;
        },
        get canRedo() {
            return cursor < entries.length - 1;
        },
    };
}
