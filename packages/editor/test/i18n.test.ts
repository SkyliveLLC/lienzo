import { describe, expect, it } from 'vitest';
import { createTranslator } from '../src/i18n/index.ts';

describe('translator', () => {
    it('falls back from region to language to English, per key', () => {
        const t = createTranslator('es-MX', { 'es-MX': { 'toolbar.publish': 'Publicar ya' } }).t;

        expect(t('toolbar.publish')).toBe('Publicar ya');
        expect(t('toolbar.theme')).toBe('Tema');
        expect(createTranslator('pt', { pt: { 'toolbar.theme': 'Tema' } }).t('toolbar.publish')).toBe('Publish');
    });

    it('fills placeholders', () => {
        expect(createTranslator('en').t('layers.count', { n: 3 })).toBe('3 sections');
    });

    it('reads app labels in the editor language', () => {
        const { localized } = createTranslator('es-CO');

        expect(localized({ en: 'Pricing', es: 'Precios' })).toBe('Precios');
        expect(localized({ en: 'Pricing' })).toBe('Pricing');
    });
});
