import type { Document, Style, Theme, ThemeToken } from '@skylivellc/lienzo-core';
import type { MessageKey } from '../i18n/index.ts';
import { canvasesOf } from './document.ts';

export const THEME_TOKENS = ['primary', 'secondary', 'background', 'surface', 'text', 'muted'] as const satisfies readonly ThemeToken[];

const tokens: ReadonlySet<string> = new Set(THEME_TOKENS);
export const isThemeToken = (value: unknown): value is ThemeToken => typeof value === 'string' && tokens.has(value);

export type Palette = Pick<Theme, ThemeToken>;

export type Gradient = NonNullable<Style['gradient']>;
export type GradientPreset = { type: 'linear' | 'radial'; from: ThemeToken; to: ThemeToken; angle: number };

/** Ready palettes, so nobody has to pick six colors blind. */
export const PALETTES: readonly { name: MessageKey; colors: Palette }[] = [
    { name: 'palette.blue', colors: { primary: '#2563eb', secondary: '#0f172a', background: '#ffffff', surface: '#f8fafc', text: '#0f172a', muted: '#64748b' } },
    { name: 'palette.mint', colors: { primary: '#0d9488', secondary: '#134e4a', background: '#ffffff', surface: '#f0fdfa', text: '#134e4a', muted: '#5f7470' } },
    { name: 'palette.sand', colors: { primary: '#b45309', secondary: '#1c1917', background: '#fffbf5', surface: '#f5eee4', text: '#1c1917', muted: '#78716c' } },
    { name: 'palette.indigo', colors: { primary: '#4f46e5', secondary: '#1e1b4b', background: '#ffffff', surface: '#f5f3ff', text: '#1e1b4b', muted: '#6b7280' } },
    { name: 'palette.graphite', colors: { primary: '#111827', secondary: '#374151', background: '#ffffff', surface: '#f3f4f6', text: '#111827', muted: '#6b7280' } },
];

/** Google fonts picked so that any pairing looks fine. Notes are message keys `font.<name>`. */
export const FONTS = ['Inter', 'Poppins', 'Montserrat', 'DM Sans', 'Work Sans', 'Nunito', 'Lora', 'Playfair Display', 'Merriweather', 'Source Sans 3'] as const;
export const fontNote = (font: (typeof FONTS)[number]): MessageKey => `font.${font}`;

export const MAX_WIDTHS = [1080, 1200, 1320, 1440] as const;
export const widthLabel = (width: (typeof MAX_WIDTHS)[number]): MessageKey => `theme.width.${width}`;

/** Gradients suggested from the palette. */
export const GRADIENT_PRESETS: readonly { name: MessageKey; gradient: GradientPreset }[] = [
    { name: 'gradient.preset.primary', gradient: { type: 'linear', from: 'primary', to: 'secondary', angle: 135 } },
    { name: 'gradient.preset.soft', gradient: { type: 'linear', from: 'surface', to: 'background', angle: 160 } },
    { name: 'gradient.preset.halo', gradient: { type: 'radial', from: 'primary', to: 'background', angle: 0 } },
    { name: 'gradient.preset.night', gradient: { type: 'linear', from: 'secondary', to: 'primary', angle: 200 } },
];

/** The CSS color of a token or hex, for swatches in the editor chrome. */
export const swatch = (value: string | null | undefined, theme: Theme): string =>
    !value ? 'transparent' : isThemeToken(value) ? theme[value] : value;

/** CSS background of a gradient, for preset swatches. */
export function gradientCss(gradient: Gradient, theme: Theme): string {
    const from = swatch(gradient.from, theme);
    const to = swatch(gradient.to, theme);

    return gradient.type === 'radial' ? `radial-gradient(circle at 50% 50%, ${from}, ${to})` : `linear-gradient(${gradient.angle ?? 135}deg, ${from}, ${to})`;
}

function distance(a: string, b: string): number {
    const channels = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
    const [r1 = 0, g1 = 0, b1 = 0] = channels(a);
    const [r2 = 0, g2 = 0, b2 = 0] = channels(b);

    return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

/** The theme token closest to a loose hex color. */
export function nearestToken(value: string, theme: Theme): ThemeToken {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
        return 'text';
    }

    return [...THEME_TOKENS].sort((a, b) => distance(value.toLowerCase(), theme[a].toLowerCase()) - distance(value.toLowerCase(), theme[b].toLowerCase()))[0] ?? 'text';
}

/**
 * Moves fixed colors (canvas backgrounds, element color and background) to
 * the closest theme token, so the page follows the palette from now on.
 */
export function linkToPalette(document: Document, theme: Theme): void {
    for (const canvas of canvasesOf(document)) {
        const background = canvas.background.color;

        if (background && !isThemeToken(background)) {
            canvas.background.color = nearestToken(background, theme);
        }

        for (const element of canvas.elements) {
            for (const key of ['color', 'background'] as const) {
                const value = element.style[key];

                if (value && !isThemeToken(value)) {
                    element.style[key] = nearestToken(value, theme);
                }
            }
        }
    }
}

/** Stylesheet URL that loads the theme fonts, the same request the public page makes. */
export function fontsHref(fonts: readonly string[]): string {
    const families = [...new Set(fonts)].map((font) => `family=${font.replaceAll(' ', '+')}:wght@300;400;500;600;700;800`).join('&');

    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
