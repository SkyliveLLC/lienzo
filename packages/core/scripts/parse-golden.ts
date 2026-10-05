/**
 * Parses every render fixture input and every fixtures/parse/inputs/<name>.json
 * with the fixture catalog, and writes fixtures/parse/<name>.json: the parsed
 * document and site settings, or their issues as `path:code` when parsing
 * fails. Other backends parse the same inputs and must produce the same JSON.
 *
 * Usage: node scripts/parse-golden.ts
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentError, parseDocument, parseSiteSettings } from '../src/index.ts';
import { fixtureCatalog, fixtureNames, readFixture } from './golden.ts';

export const parseFixtures = join(import.meta.dirname, '../../../fixtures/parse');
const parseInputs = join(parseFixtures, 'inputs');

type Input = { document?: unknown; site?: unknown };
type Outcome = { ok: unknown } | { issues: string[] };

function outcome(parse: () => unknown): Outcome {
    try {
        return { ok: parse() };
    } catch (error) {
        if (error instanceof DocumentError) {
            return { issues: error.issues.map((issue) => `${issue.path}:${issue.code}`) };
        }

        throw error;
    }
}

/** Every parse input by golden name: the render fixtures first, then the parse-only edge cases. */
export function parseCases(): Map<string, Input> {
    const cases = new Map<string, Input>(fixtureNames().map((name) => [name, readFixture(name)]));

    for (const file of readdirSync(parseInputs).filter((name) => name.endsWith('.json')).sort()) {
        const name = file.slice(0, -'.json'.length);

        if (cases.has(name)) {
            throw new Error(`fixtures/parse/inputs/${file} shadows the render fixture of the same name`);
        }

        cases.set(name, JSON.parse(readFileSync(join(parseInputs, file), 'utf8')) as Input);
    }

    return cases;
}

/** The golden for one input. A side the input leaves out is left out. */
export function parseGolden(input: Input): string {
    const catalog = fixtureCatalog();
    const golden = {
        ...('document' in input ? { document: outcome(() => parseDocument(input.document, catalog)) } : {}),
        ...('site' in input ? { site: outcome(() => parseSiteSettings(input.site)) } : {}),
    };

    return `${JSON.stringify(golden, null, 2)}\n`;
}

if (import.meta.main) {
    for (const [name, input] of parseCases()) {
        writeFileSync(join(parseFixtures, `${name}.json`), parseGolden(input));
    }
}


