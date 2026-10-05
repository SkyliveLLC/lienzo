import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fixtureNames, goldens, readFixture, renderFixture, renderFixtures } from '../scripts/golden.ts';
import { parseCases, parseFixtures, parseGolden } from '../scripts/parse-golden.ts';
import { compileRuntime, generatedModule } from '../scripts/runtime.ts';

describe('render goldens', () => {
    it.each(fixtureNames())('%s matches its goldens (run `pnpm golden` after an intended change)', async (name) => {
        const { html, css } = goldens(await renderFixture(readFixture(name)));

        expect(html).toBe(readFileSync(join(renderFixtures, `${name}.html`), 'utf8'));
        expect(css).toBe(readFileSync(join(renderFixtures, `${name}.css`), 'utf8'));
    });
});

describe('parse goldens', () => {
    it.each([...parseCases()])('%s matches its golden (run `pnpm golden` after an intended change)', (name, input) => {
        expect(parseGolden(input)).toBe(readFileSync(join(parseFixtures, `${name}.json`), 'utf8'));
    });
});

it('inlines the runtime compiled from runtime.ts (run `pnpm runtime` after editing it)', () => {
    expect(readFileSync(join(import.meta.dirname, '../src/runtime.generated.ts'), 'utf8')).toBe(generatedModule(compileRuntime()));
});
