import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from '../src/index.ts';

export const root = join(import.meta.dirname, '../../..');
export const fixtures = join(root, 'fixtures');

export type StoredDocument = {
    title: string;
    seo: { title: string | null; description: string | null };
    theme: Record<string, unknown>;
    profile: Record<string, unknown>;
    content: unknown;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

export const documentNames = readdirSync(join(fixtures, 'documents'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length));

export const storedDocument = (name: string) => readJson(join(fixtures, 'documents', `${name}.json`)) as StoredDocument;

export const fixtureCatalog = readJson(join(fixtures, 'render/catalog.json')) as Catalog;
