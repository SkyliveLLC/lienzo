import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { Readable } from 'node:stream';
import type { Connect, Plugin } from 'vite';
import { createBackend } from './backend.ts';

const STANDALONE = join(import.meta.dirname, '../../dist/standalone');
const TYPES: Readonly<Record<string, string>> = { '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };

/**
 * Mounts the mock backend on the dev and preview servers: the protocol under
 * `/api`, published pages under `/site/`, and the built standalone bundle
 * under `/standalone/` for the custom element harness.
 */
export function mockBackend(options: { latency?: number } = {}): Plugin {
    let backend: ReturnType<typeof createBackend> | null = null;

    const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

        if (url.pathname.startsWith('/api')) {
            void api(req, res, url);
        } else if (url.pathname.startsWith('/site')) {
            void site(res, url);
        } else if (url.pathname.startsWith('/standalone/')) {
            void standalone(res, url);
        } else {
            next();
        }
    };

    const instance = (url: URL) => (backend ??= createBackend({ publicUrl: `${url.origin}/site/`, latency: options.latency }));

    async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
        const method = req.method ?? 'GET';
        const request = new Request(url, {
            method,
            headers: Object.entries(req.headers).flatMap(([name, value]): [string, string][] => (typeof value === 'string' ? [[name, value]] : [])),
            ...(method === 'GET' || method === 'HEAD' ? {} : { body: Readable.toWeb(req) as ReadableStream, duplex: 'half' }),
        });
        const multipart = request.headers.get('content-type')?.startsWith('multipart/form-data') ?? false;
        const form = multipart ? await request.formData() : null;
        const file = form?.get('file');
        const text = multipart || method === 'GET' ? '' : await request.text();
        const response = await instance(url).handle({
            method,
            path: url.pathname.slice('/api'.length) || '/',
            json: text ? JSON.parse(text) : null,
            file: file instanceof File ? file : null,
        });

        res.statusCode = response.status;

        if (response.bytes) {
            res.setHeader('Content-Type', response.type ?? 'application/octet-stream');
            res.end(response.bytes);
        } else if (response.status === 204) {
            res.end();
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response.json ?? null));
        }
    }

    async function site(res: ServerResponse, url: URL) {
        const response = await instance(url).publicPage(url.pathname.replace(/^\/site\/?/, '').replace(/\/$/, ''));
        res.statusCode = response.status;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(response.html ?? '');
    }

    async function standalone(res: ServerResponse, url: URL) {
        const file = normalize(join(STANDALONE, url.pathname.slice('/standalone/'.length)));

        try {
            if (!file.startsWith(STANDALONE)) {
                throw new Error('outside');
            }

            res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
            res.end(await readFile(file));
        } catch {
            res.statusCode = 404;
            res.end('Build the standalone bundle first: pnpm build');
        }
    }

    return {
        name: 'lienzo-mock-backend',
        configureServer: (server) => void server.middlewares.use(middleware),
        configurePreviewServer: (server) => void server.middlewares.use(middleware),
    };
}
