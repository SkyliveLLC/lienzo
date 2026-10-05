import type { CoreActionType, Field } from '@skylive/lienzo-core';
import type { MessageKey } from '../i18n/index.ts';

/** How the value of a core action is edited, by what core does with it. */
type ValueControl =
    | { kind: 'none' }
    | { kind: 'submit' }
    | { kind: 'text'; placeholder: MessageKey }
    | { kind: 'anchor' }
    | { kind: 'modal' }
    | { kind: 'page' };

/** The value control of each core action. Labels are `action.<type>`; core's own order is the picker's. */
export const CORE_ACTIONS = {
    none: { kind: 'none' },
    whatsapp: { kind: 'text', placeholder: 'action.placeholder.whatsapp' },
    phone: { kind: 'text', placeholder: 'action.placeholder.phone' },
    email: { kind: 'text', placeholder: 'action.placeholder.email' },
    url: { kind: 'text', placeholder: 'action.placeholder.url' },
    anchor: { kind: 'anchor' },
    modal: { kind: 'modal' },
    submit: { kind: 'submit' },
    page: { kind: 'page' },
    top: { kind: 'none' },
    back: { kind: 'none' },
    step_next: { kind: 'none' },
    step_prev: { kind: 'none' },
} as const satisfies Record<CoreActionType, ValueControl>;

export const isCoreAction = (type: string): type is CoreActionType => Object.hasOwn(CORE_ACTIONS, type);

/** An app action's value is stored as a string in `action.value`; this is its starting value. */
export function defaultActionValue(field: Exclude<Field, { kind: 'action' }> | null): string {
    if (!field || field.kind === 'image') {
        return '';
    }

    return field.default === undefined ? '' : String(field.default);
}
