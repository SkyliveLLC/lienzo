import base from './base.css?inline';
import canvas from './canvas.css?inline';
import shell from './shell.css?inline';
import panels from './panels.css?inline';

/** All chrome CSS as one string, adopted by the document or shadow root the editor renders in. */
export const editorCss = [base, shell, canvas, panels].join('\n');

const adopted = new WeakMap<Document | ShadowRoot, CSSStyleSheet>();

/**
 * Adds the editor's stylesheet to the root `node` renders in, once. A
 * constructed stylesheet works the same in a document and in a shadow root
 * (the custom element), and needs no `<style>` tag a strict CSP would block.
 */
export function adoptEditorStyles(node: Node): void {
    const root = node.getRootNode();

    if (!(root instanceof Document || root instanceof ShadowRoot) || adopted.has(root)) {
        return;
    }

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(editorCss);
    adopted.set(root, sheet);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}
