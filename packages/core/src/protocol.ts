/**
 * `@skylive/lienzo-core/protocol`: the HTTP contract between the editor and
 * any backend. Paths are relative to the `endpoint` the host page gives the
 * editor. Laravel implements it first; other backends implement the same table.
 */
import type { Catalog } from './catalog.ts';
import type { Document, FieldValue, Issue, Seo, SiteSettings, Theme } from './document.ts';

export type Asset = {
    id: number;
    /** `media:<id>`, what documents store. */
    ref: string;
    name: string;
    url: string;
    thumb: string;
    width: number | null;
    height: number | null;
};

export type PageSummary = { id: number; slug: string; title: string; publishedAt: string | null };

export type PageVersion = { id: number; createdAt: string; by: string | null };

export type PageState = PageSummary & {
    seo: Seo;
    draft: Document;
    /** Increments on every saved draft. Writes send it back as `baseRevision`. */
    revision: number;
    versions: PageVersion[];
};

/** Values of the catalog's `siteFields`, by field key. */
export type SiteMeta = Record<string, FieldValue>;

export type Workspace = {
    site: SiteSettings;
    meta: SiteMeta;
    /** Public URL of the site root, for "view site" links and page address previews. Null when not served yet. */
    publicUrl: string | null;
    pages: PageSummary[];
    catalog: Catalog;
    assets: Asset[];
    quota: { used: number; limit: number };
};

export type SiteUpdate = {
    theme?: Partial<Theme>;
    seo?: Seo;
    locale?: string;
    favicon?: string | null;
    og_image?: string | null;
    meta?: SiteMeta;
};

/** `fields` holds the answers by field label. A checkbox answer is a boolean; the editor words it in its own language. */
export type Submission = { id: number; page: string; source: string; fields: Record<string, string | boolean>; createdAt: string };

/** Every route, keyed by `METHOD path`. `req` is the JSON body; `res` is the 2xx JSON body. */
export type Protocol = {
    'GET /': { res: Workspace };
    'PUT /site': { req: SiteUpdate; res: Workspace };
    'GET /pages/:id': { res: PageState };
    'POST /pages': { req: { title: string; slug: string; draft?: Document }; res: PageState };
    /** Answers 409 with `Conflict` when `baseRevision` is not the stored revision: two tabs never overwrite each other. */
    'PUT /pages/:id': {
        req: { baseRevision: number; title?: string; slug?: string; seo?: Seo; draft?: Document };
        res: { revision: number };
    };
    'DELETE /pages/:id': { res: null };
    /**
     * Publishes the draft at `revision`. Idempotent: publishing a draft equal
     * to what is already published creates no new version and returns the same state.
     */
    'POST /pages/:id/publish': { req: { revision: number }; res: PageState };
    'POST /pages/:id/versions/:version/restore': { res: PageState };
    /** Multipart upload with one `file` field. */
    'POST /assets': { req: FormData; res: Asset };
    'DELETE /assets/:id': { res: null };
    /**
     * HTML of app elements for the editor canvas, keyed by element id. The
     * backend renders them with the same code as the public page.
     */
    'POST /preview': {
        req: { elements: { id: string; type: string; props: Record<string, unknown> }[] };
        res: Record<string, string>;
    };
    'GET /submissions': { req?: { cursor?: string }; res: { data: Submission[]; next: string | null } };
};

export type Route = keyof Protocol;
export type RequestBody<R extends Route> = Protocol[R] extends { req?: infer B } ? B : never;
export type ResponseBody<R extends Route> = Protocol[R]['res'];

/** 422 body for any write. Issue paths use dots: `draft.sections.0.elements.3.style.color`. */
export type ProtocolError = { message: string; issues: Issue[] };

/** 409 body for a stale `baseRevision`: the editor offers to reload the current revision. */
export type Conflict = { message: string; revision: number };
