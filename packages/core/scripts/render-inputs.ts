/**
 * Writes fixtures/render/<name>.json for every fixtures/documents/<name>.json:
 * the stored document plus fixed site settings and host stubs, so any
 * backend can render the same input and compare bytes with the goldens.
 * Hand-written render fixtures (no matching document) are left alone.
 *
 * Usage: node scripts/render-inputs.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FixtureInput } from './golden.ts';

const fixtures = join(import.meta.dirname, '../../../fixtures');

/** Same library as the baseline capture: id 3 has no thumbnail or size, anything else is a deleted asset. */
const library = [
    { id: 1, thumb: true, width: 1600, height: 1067 },
    { id: 2, thumb: true, width: 1200, height: 1200 },
    { id: 3, thumb: false, width: null, height: null },
    { id: 4, thumb: true, width: 512, height: 512 },
];

type Stored = { title: string; seo: Record<string, string | null>; theme: Record<string, unknown>; profile: Record<string, unknown>; content: unknown };

for (const file of readdirSync(join(fixtures, 'documents')).filter((name) => name.endsWith('.json')).sort()) {
    const stored = JSON.parse(readFileSync(join(fixtures, 'documents', file), 'utf8')) as Stored;
    const input: FixtureInput = {
        document: stored.content,
        site: {
            name: 'Demo Site',
            locale: 'es',
            theme: stored.theme,
            seo: { title: null, description: null },
            favicon: stored.profile.favicon ?? null,
            og_image: stored.profile.og_image ?? null,
        },
        page: { slug: '', seo: stored.seo, url: 'https://demo.test/' },
        base: '',
        mode: 'public',
        host: {
            media: Object.fromEntries(library.map((asset) => [`media:${asset.id}`, {
                url: `https://demo.test/media/${asset.id}`,
                thumb: asset.thumb ? `https://demo.test/media/${asset.id}/thumb` : null,
                width: asset.width,
                height: asset.height,
            }])),
            actions: { booking: '/book' },
            form: {
                action: 'https://demo.test/site-messages',
                csrf: { name: '_token', value: 'fixture-csrf-token' },
                old: {},
                errors: {},
                notice: null,
            },
            nonce: null,
            head: null,
        },
    };

    writeFileSync(join(fixtures, 'render', file), `${JSON.stringify(input, null, 2)}\n`);
}
