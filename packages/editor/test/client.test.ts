import { describe, expect, it } from 'vitest';
import { createClient } from '../src/client.ts';

function recorder(status: number, body: unknown) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });

        return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    };

    return { calls, fetch: fetcher as typeof fetch };
}

describe('client', () => {
    it('fills path params and sends JSON with the extra headers', async () => {
        const server = recorder(200, { revision: 4 });
        const client = createClient({ endpoint: '/lienzo/', headers: { Authorization: 'Bearer x' }, fetch: server.fetch });
        const result = await client('PUT /pages/:id', { id: 3 }, { baseRevision: 3 });

        expect(result).toEqual({ ok: true, value: { revision: 4 } });
        expect(server.calls[0]?.url).toBe('/lienzo/pages/3');
        expect(server.calls[0]?.init.method).toBe('PUT');
        expect(server.calls[0]?.init.body).toBe('{"baseRevision":3}');
        expect(server.calls[0]?.init.headers).toMatchObject({ Authorization: 'Bearer x', 'Content-Type': 'application/json' });
    });

    it('turns 409 into a conflict with the current revision', async () => {
        const client = createClient({ endpoint: '/api', fetch: recorder(409, { message: 'Stale', revision: 9 }).fetch });

        expect(await client('PUT /pages/:id', { id: 1 }, { baseRevision: 2 })).toEqual({ ok: false, failure: { kind: 'conflict', message: 'Stale', revision: 9 } });
    });

    it('turns 422 into issues, dropping malformed ones', async () => {
        const issues = [{ path: 'slug', code: 'pattern', message: 'Bad' }, { nope: true }];
        const client = createClient({ endpoint: '/api', fetch: recorder(422, { message: 'Invalid', issues }).fetch });

        expect(await client('POST /pages', { title: 'A', slug: 'B' })).toEqual({ ok: false, failure: { kind: 'invalid', message: 'Invalid', issues: [issues[0]] } });
    });

    it('reports a network error as offline instead of throwing', async () => {
        const client = createClient({ endpoint: '/api', fetch: (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch });

        expect(await client('GET /')).toEqual({ ok: false, failure: { kind: 'offline' } });
    });

    it('sends GET bodies as a query string', async () => {
        const server = recorder(200, { data: [], next: null });
        await createClient({ endpoint: '/api', fetch: server.fetch })('GET /submissions', { cursor: 'abc' });

        expect(server.calls[0]?.url).toBe('/api/submissions?cursor=abc');
    });
});
