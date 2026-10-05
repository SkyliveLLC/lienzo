import type { Localized } from '@skylive/lienzo-core';
import { en, type MessageKey, type Messages } from './en.ts';
import { es } from './es.ts';

export { en, es };
export type { MessageKey, Messages };

/** Packs shipped with the editor. Apps add or override locales through the `messages` prop. */
export const packs: Readonly<Record<string, Messages>> = { en, es };

/** Extra or overriding strings, by locale. A partial pack falls back to English per key. */
export type MessageOverrides = Readonly<Record<string, Partial<Messages>>>;

export type Translator = {
    locale: string;
    t(key: MessageKey, params?: Readonly<Record<string, string | number>>): string;
    /** Text the app declared in its catalog, in the editor's locale. */
    localized(text: Localized): string;
};

/** `es-MX` reads `es-MX`, then `es`, then English, for each key. */
export function createTranslator(locale: string, overrides: MessageOverrides = {}): Translator {
    const language = locale.split('-')[0] ?? locale;
    const chain: Partial<Messages>[] = [
        overrides[locale] ?? {},
        packs[locale] ?? {},
        overrides[language] ?? {},
        packs[language] ?? {},
        overrides.en ?? {},
    ];
    const lookup = (key: MessageKey): string => chain.find((pack) => pack[key] !== undefined)?.[key] ?? en[key];

    return {
        locale,
        t: (key, params) => format(lookup(key), params),
        localized: (text) => text[locale] ?? text[language] ?? text.en,
    };
}

export function format(template: string, params?: Readonly<Record<string, string | number>>): string {
    return params ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : template;
}
