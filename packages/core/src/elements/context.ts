import { safeId } from '../canvas.ts';
import type { Action, CoreElement } from '../document.ts';
import { fragment, h, text, type Attrs, type Child, type Tag, type TrustedHtml } from '../html.ts';
import type { Messages } from '../messages.ts';

export type MediaFile = { url: string; thumb: string | null; width: number | null; height: number | null };

/** What an element function may ask of the page being rendered. */
export type ElementContext = {
    t: Messages;
    /** A `media:<id>` reference resolved by the host, or an https URL as-is. Null when nothing resolves. */
    media(src: string | null | undefined): MediaFile | null;
    /** Link attributes for an action, or null when it goes nowhere. */
    action(action: Action | null | undefined): Attrs | null;
    /** Submitted values and errors, when this canvas is a live form. Keys are `fields.<id>`. */
    form: { old(key: string): string | null; error(key: string): string | null } | null;
};

/** The element's root node. The renderer adds id, class `lz-el`, the style projection and the vars block. */
export type ElementNode = { tag: Tag; class?: string; attrs?: Attrs; children?: readonly Child[] };

export type ElementRenderer = (element: CoreElement, context: ElementContext) => ElementNode;


/** Text with one part in the accent color, for two-tone headings. */
export function accented(element: CoreElement): TrustedHtml {
    const content = element.props.text ?? '';
    const part = (element.props.accent ?? '').trim();
    const at = part === '' || !element.style.accent_color ? -1 : content.indexOf(part);

    if (at === -1) {
        return text(content);
    }

    return fragment([
        text(content.slice(0, at)),
        h('span', { class: 'lz-accent' }, [text(part)]),
        text(content.slice(at + part.length)),
    ]);
}

/** Label row shared by every form field: the text and a required mark. */
export const fieldLabel = (element: CoreElement): TrustedHtml =>
    h('span', {}, [text((element.props.label ?? '').trim()), element.props.required ? h('i', {}, [text('*')]) : null]);

export const fieldKey = (element: CoreElement): string => `fields.${safeId(element.id)}`;
export const fieldName = (element: CoreElement): string => `fields[${safeId(element.id)}]`;

export function fieldError(element: CoreElement, context: ElementContext): TrustedHtml | null {
    const message = context.form?.error(fieldKey(element)) ?? null;

    return message === null ? null : h('em', { class: 'lz-field-error' }, [text(message)]);
}
