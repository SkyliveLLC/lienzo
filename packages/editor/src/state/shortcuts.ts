import type { Editor } from './editor.ts';

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Whether a key event belongs to a text control, where keys mean typing. */
function typing(event: KeyboardEvent): boolean {
    const target = event.composedPath()[0];

    if (!target || typeof (target as Partial<HTMLElement>).tagName !== 'string') {
        return false;
    }

    const element = target as HTMLElement;

    return TYPING.has(element.tagName) || element.isContentEditable;
}

/**
 * Editor shortcuts: Escape, Delete, arrows, and Ctrl/Cmd with C, V, D, Z,
 * Shift+Z and S. Keys typed into a field are left alone. Returns whether the
 * event was handled, so the canvas iframe and the host page share one map.
 */
export function handleShortcut(editor: Editor, event: KeyboardEvent): boolean {
    if (typing(event) || editor.state.dialog !== null || editor.state.library !== null || editor.state.previewing) {
        return false;
    }

    const selected = editor.state.selection.kind === 'elements';
    const command = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (!command) {
        switch (event.key) {
            case 'Escape':
                editor.clearSelection();

                return true;
            case 'Delete':
            case 'Backspace':
                if (!selected) {
                    return false;
                }

                event.preventDefault();
                editor.removeSelected();

                return true;
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown': {
                if (!selected) {
                    return false;
                }

                const step = event.shiftKey ? 10 : 1;
                event.preventDefault();
                editor.nudge(
                    event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
                    event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
                );

                return true;
            }
            default:
                return false;
        }
    }

    switch (key) {
        case 'c':
            editor.copySelected();

            return true;
        case 'v':
            editor.paste();

            return true;
        case 'd':
            event.preventDefault();
            editor.duplicateSelected();

            return true;
        case 'z':
            event.preventDefault();
            if (event.shiftKey) {
                editor.redo();
            } else {
                editor.undo();
            }

            return true;
        case 'y':
            event.preventDefault();
            editor.redo();

            return true;
        case 's':
            event.preventDefault();
            void editor.saveNow();

            return true;
        default:
            return false;
    }
}
