/**
 * Copies the static assets the PHP renderer reads from packages/core/dist
 * into packages/laravel/dist, where the Composer package ships them. Run it
 * after `pnpm build` whenever an asset changes; the PHP suite fails while the
 * copies differ from a fresh build.
 *
 * Usage: node scripts/sync-php-assets.ts
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const phpAssets = ['lienzo.css', 'runtime.js', 'schema.json', 'data.json'] as const;

const root = join(import.meta.dirname, '..');
const from = join(root, 'packages/core/dist');
const to = join(root, 'packages/laravel/dist');

mkdirSync(to, { recursive: true });

for (const file of phpAssets) {
    copyFileSync(join(from, file), join(to, file));
}
