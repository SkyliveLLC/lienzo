import { safeId } from './canvas.ts';
import type { Action, CoreActionType } from './document.ts';
import type { Attrs } from './html.ts';

/**
 * What each core action does, as data so every backend reads the same table.
 * A `link` builds an href from the value: keep only `keep` characters
 * (a regex character class), optionally lowercase and trim, then prefix. A
 * `behavior` is handled by `runtime.js` through a data attribute; an `id`
 * value is the target's id, made selector-safe like every rendered id.
 */
type CoreActionRule =
    | { readonly kind: 'none' }
    | { readonly kind: 'submit' }
    | {
        readonly kind: 'link';
        readonly prefix: string;
        readonly keep?: string;
        readonly lower?: true;
        readonly trim?: string;
        /** The value must already start with this, and is used as-is. */
        readonly requires?: string;
        /** Prefix with the site's base path (page links). */
        readonly base?: true;
    }
    | { readonly kind: 'behavior'; readonly attr: 'modal' | 'top' | 'back' | 'step'; readonly value: 'id' | 'next' | 'prev' | null };

export const coreActions = {
    none: { kind: 'none' },
    submit: { kind: 'submit' },
    whatsapp: { kind: 'link', prefix: 'https://wa.me/', keep: '0-9' },
    phone: { kind: 'link', prefix: 'tel:', keep: '0-9+' },
    email: { kind: 'link', prefix: 'mailto:' },
    url: { kind: 'link', prefix: '', requires: 'https://' },
    anchor: { kind: 'link', prefix: '#', keep: 'a-zA-Z0-9_-' },
    page: { kind: 'link', prefix: '/', keep: 'a-z0-9-', lower: true, trim: '-', base: true },
    modal: { kind: 'behavior', attr: 'modal', value: 'id' },
    top: { kind: 'behavior', attr: 'top', value: null },
    back: { kind: 'behavior', attr: 'back', value: null },
    step_next: { kind: 'behavior', attr: 'step', value: 'next' },
    step_prev: { kind: 'behavior', attr: 'step', value: 'prev' },
} as const satisfies Record<CoreActionType, CoreActionRule>;

const isCoreAction = (type: string): type is CoreActionType => Object.hasOwn(coreActions, type);

/**
 * Attributes for a link that performs `action`, or null when it goes nowhere.
 * `appAction` answers for app-registered types; unknown types render inert.
 */
export function actionAttrs(
    action: Action | null | undefined,
    base: string,
    appAction: (action: Action & { type: string }) => string | null,
): Attrs | null {
    const type = action?.type ?? 'none';
    const value = (action?.value ?? '').trim();

    if (!isCoreAction(type)) {
        const href = action ? appAction({ ...action, type }) : null;

        return href === null ? null : linkAttrs(href);
    }

    const rule: CoreActionRule = coreActions[type];

    switch (rule.kind) {
        case 'none':
        case 'submit':
            return null;
        case 'behavior':
            if (rule.value === 'id' && value === '') {
                return null;
            }

            return { href: '#', [`data-${rule.attr}`]: rule.value === null ? true : rule.value === 'id' ? safeId(value) : rule.value };
        case 'link': {
            if (value === '' || (rule.requires !== undefined && !value.startsWith(rule.requires))) {
                return null;
            }

            let target = rule.lower ? value.toLowerCase() : value;
            target = rule.keep === undefined ? target : target.replace(new RegExp(`[^${rule.keep}]`, 'g'), '');
            target = rule.trim === undefined ? target : trimChars(target, rule.trim);

            return linkAttrs(`${rule.base ? base : ''}${rule.prefix}${target}`);
        }
    }
}

const linkAttrs = (href: string): Attrs =>
    /^https?:\/\//.test(href) ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href };

function trimChars(value: string, chars: string): string {
    let start = 0;
    let end = value.length;

    while (start < end && chars.includes(value[start] ?? '')) {
        start++;
    }

    while (end > start && chars.includes(value[end - 1] ?? '')) {
        end--;
    }

    return value.slice(start, end);
}
