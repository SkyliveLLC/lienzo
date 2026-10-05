/**
 * Copies the root LICENSE and THIRD_PARTY_NOTICES.md into the package being
 * packed, so the npm tarball carries them. Runs as each package's `prepack`.
 */
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

for (const file of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    copyFileSync(join(root, file), join(process.cwd(), file));
}
