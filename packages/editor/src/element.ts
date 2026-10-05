import { defineCustomElement } from 'vue';
import LienzoEditor from './LienzoEditor.vue';

/**
 * `<lienzo-editor endpoint="/admin/lienzo" locale="es">`. Attributes:
 * `endpoint`, `locale`. Properties: `messages`, `headers`, `fetch`. The
 * editor renders in a shadow root, so host page CSS does not reach it.
 * Set the properties before the element is attached; like the component's
 * props, they are read once.
 */
export const LienzoEditorElement = defineCustomElement(LienzoEditor, { shadowRoot: true });

/** Registers the element under `tag`, once. The side-effect import registers `lienzo-editor`. */
export function defineLienzoEditor(tag = 'lienzo-editor'): void {
    if (!customElements.get(tag)) {
        customElements.define(tag, LienzoEditorElement);
    }
}

defineLienzoEditor();

declare global {
    interface HTMLElementTagNameMap {
        'lienzo-editor': InstanceType<typeof LienzoEditorElement>;
    }
}
