import type { Issue } from '@skylivellc/lienzo-core';
import type { Protocol, Route } from '@skylivellc/lienzo-core/protocol';

/** Why a request did not succeed. Every caller handles each kind, so none is ever silent. */
export type Failure =
    | { kind: 'offline' }
    | { kind: 'conflict'; message: string; revision: number }
    | { kind: 'invalid'; message: string; issues: Issue[] }
    | { kind: 'http'; status: number; message: string };

export type Result<T> = { ok: true; value: T } | { ok: false; failure: Failure };

/** `'PUT /pages/:id/versions/:version'` → `'id' | 'version'`. */
type ParamNames<P extends string> = P extends `${string}:${infer Name}/${infer Rest}`
    ? Name | ParamNames<`/${Rest}`>
    : P extends `${string}:${infer Name}`
      ? Name
      : never;

export type Params<R extends Route> = { [K in ParamNames<R>]: string | number };
export type Body<R extends Route> = 'req' extends keyof Protocol[R] ? Protocol[R]['req' & keyof Protocol[R]] : undefined;
export type Response<R extends Route> = Protocol[R]['res'];

type BodyArgs<R extends Route> = undefined extends Body<R> ? [body?: Body<R>] : [body: Body<R>];

/** A route call: params only when the path has some, a body only when the route takes one. */
export type Client = <R extends Route>(
    route: R,
    ...args: [ParamNames<R>] extends [never] ? BodyArgs<R> : [params: Params<R>, ...BodyArgs<R>]
) => Promise<Result<Response<R>>>;

export type ClientOptions = {
    endpoint: string;
    headers?: Record<string, string>;
    fetch?: typeof fetch;
};

/**
 * Typed fetch over the protocol. Never retries writes and never throws:
 * a 409 becomes `conflict`, a 422 `invalid`, a network error `offline`.
 * Laravel's `XSRF-TOKEN` cookie is echoed as `X-XSRF-TOKEN`, like axios does,
 * so session-authenticated backends need no extra setup.
 */
export function createClient({ endpoint, headers = {}, fetch: fetcher = globalThis.fetch.bind(globalThis) }: ClientOptions): Client {
    const base = endpoint.replace(/\/+$/, '');

    return async (route, ...args) => {
        const [method = 'GET', template = '/'] = route.split(' ');
        const [params, body]: [Record<string, unknown>, unknown] = template.includes(':')
            ? [isRecord(args[0]) ? args[0] : {}, args[1]]
            : [{}, args[0]];
        const path = template.replace(/:([a-z]+)/g, (_, name: string) => encodeURIComponent(String(params[name] ?? '')));
        const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
        const query = method === 'GET' && body && typeof body === 'object' && !isForm ? searchParams(body) : '';
        const init: RequestInit = {
            method,
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                ...(body !== undefined && method !== 'GET' && !isForm ? { 'Content-Type': 'application/json' } : {}),
                ...xsrfHeader(),
                ...headers,
            },
            ...(body !== undefined && method !== 'GET' ? { body: isForm ? body : JSON.stringify(body) } : {}),
        };

        let response: globalThis.Response;

        try {
            response = await fetcher(`${base}${path === '/' ? '' : path}${query}`, init);
        } catch {
            return { ok: false, failure: { kind: 'offline' } };
        }

        const json: unknown = response.status === 204 ? null : await response.json().catch(() => null);

        if (response.ok) {
            // The backend implements the protocol; documents and settings inside are parsed again where they are used.
            return { ok: true, value: json as Response<typeof route> };
        }

        return { ok: false, failure: failureOf(response.status, json) };
    };
}

function failureOf(status: number, json: unknown): Failure {
    const message = isRecord(json) && typeof json.message === 'string' ? json.message : `HTTP ${status}`;

    if (status === 409 && isRecord(json) && typeof json.revision === 'number') {
        return { kind: 'conflict', message, revision: json.revision };
    }

    if (status === 422) {
        const issues = isRecord(json) && Array.isArray(json.issues) ? json.issues.filter(isIssue) : [];

        return { kind: 'invalid', message, issues };
    }

    return { kind: 'http', status, message };
}

function searchParams(body: object): string {
    const entries = Object.entries(body).filter(([, value]) => value !== undefined && value !== null);

    return entries.length === 0 ? '' : `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)]))}`;
}

function xsrfHeader(): Record<string, string> {
    const match = typeof document === 'undefined' ? null : /(?:^|;\s*)XSRF-TOKEN=([^;]+)/.exec(document.cookie);

    return match?.[1] ? { 'X-XSRF-TOKEN': decodeURIComponent(match[1]) } : {};
}

const isIssue = (value: unknown): value is Issue =>
    isRecord(value) && typeof value.path === 'string' && typeof value.message === 'string' && typeof value.code === 'string';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
