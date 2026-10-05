/** Strings the public page shows. `{n}` is replaced with a 1-based position. */
const en = {
    close: 'Close',
    menu: 'Open the menu',
    sections: 'Sections',
    step: 'Step {n}',
    tab: 'Tab {n}',
    choose: 'Choose an option',
    submit: 'Send',
    icon: 'Icon',
    video: 'Video',
    unavailable: 'This element needs a plugin that is not installed',
};

export type Messages = Record<keyof typeof en, string>;

const es: Messages = {
    close: 'Cerrar',
    menu: 'Abrir el menú',
    sections: 'Secciones',
    step: 'Paso {n}',
    tab: 'Pestaña {n}',
    choose: 'Elige una opción',
    submit: 'Enviar',
    icon: 'Icono',
    video: 'Video',
    unavailable: 'Este elemento necesita un complemento que no está instalado',
};

export const messages: Readonly<Record<string, Messages>> & { en: Messages } = { en, es };

/** `es-MX` falls back to `es`, then to English. */
export function messagesFor(locale: string): Messages {
    return messages[locale] ?? messages[locale.split('-')[0] ?? ''] ?? messages.en;
}
