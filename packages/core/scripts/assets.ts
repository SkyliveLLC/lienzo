/**
 * Writes the static assets every backend ships next to the renderer:
 *   dist/lienzo.css   the stylesheet
 *   dist/runtime.js   the page behaviour
 *   dist/schema.json  JSON Schema of the document and site settings
 *   dist/data.json    shared tables: style projection, icons, core actions, messages, defaults
 *
 * Usage: node scripts/assets.ts   (run by `pnpm build` after tsdown)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assets } from '../src/assets.ts';

const dist = join(import.meta.dirname, '../dist');
mkdirSync(dist, { recursive: true });

for (const [file, contents] of Object.entries(assets())) {
    writeFileSync(join(dist, file), contents);
}
