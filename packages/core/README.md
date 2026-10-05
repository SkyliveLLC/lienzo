# @skylivellc/lienzo-core

The document format and renderer of [Lienzo](https://github.com/SkyliveLLC/lienzo), an open-source landing page builder. It parses page documents, renders them to static HTML, and defines the HTTP protocol the Lienzo editor speaks. It has no framework dependency and runs in Node and in the browser.

Use this package to host Lienzo on a backend other than Laravel. Laravel apps use the Composer package `skylive/lienzo`, which ships a PHP renderer that produces the same bytes.

```sh
npm install @skylivellc/lienzo-core
```

## Validate a document

`parseDocument` is the only way to get a `Parsed<Document>`. It throws a `DocumentError` whose `issues` carry dotted paths, such as `sections.0.elements.3.style.color`:

```ts
import { DocumentError, parseDocument, type Catalog, type Document } from '@skylivellc/lienzo-core';

const catalog: Catalog = { elements: [], actions: [] };

/** The draft to store, or the 422 answer the editor shows next to each problem. */
function readDraft(input: unknown): Document | Response {
	try {
		return parseDocument(input, catalog);
	} catch (error) {
		if (error instanceof DocumentError) {
			return Response.json({ message: 'The page is not valid.', issues: error.issues }, { status: 422 });
		}
		throw error;
	}
}
```

The catalog lists the elements, actions and site fields your app registers. `parseSiteSettings`, `parseTheme`, `parseSeo` and `parseFields` validate the other values the editor sends.

## Render a published page

`renderPage` returns the complete HTML document, with `lienzo.css` and the page script inlined. The `host` answers what the renderer cannot know: image URLs, app action links, app element markup and form state.

```ts
import { parseDocument, parseSiteSettings, renderPage, trustedHtml } from '@skylivellc/lienzo-core';

const page = await renderPage({
	document: parseDocument(stored.published, catalog),
	catalog,
	site: parseSiteSettings(stored.site),
	page: { slug: 'pricing', seo: stored.seo, url: 'https://example.com/pricing' },
	base: '',
	mode: 'public',
	host: {
		media: (ref) => lookUpImage(ref), // `media:<id>` to { url, thumb, width, height }, or null
		action: (action) => null, // an href for your app's action types
		appElement: (element) => trustedHtml(renderMyElement(element)),
		form: { action: '/submit', csrf: null, old: () => null, error: () => null, notice: null },
	},
});

return new Response(page.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
```

`appElement` output, `head` and app element CSS are the only HTML the renderer does not escape. Escape your data in them.

## Accept form submissions

Published forms post `source`, `slug`, and `fields[<name>]` values. Look up the form with `formFields(publishedDocument)` by its `source`, and validate the posted values against that field list, not against what the browser sent.

## Implement the editor protocol

`@skylivellc/lienzo-core/protocol` exports the `Protocol` type: every route the editor calls, keyed by method and path, with its request and response bodies. `Workspace`, `PageState`, `Asset` and `Submission` describe the payloads. [`examples/vanilla/server.ts`](https://github.com/SkyliveLLC/lienzo/blob/main/examples/vanilla/server.ts) implements all of it on `node:http`.

## Static files

These files are also exported, for backends that serve them separately:

| Export | Contents |
| --- | --- |
| `@skylivellc/lienzo-core/lienzo.css` | The page stylesheet. |
| `@skylivellc/lienzo-core/runtime.js` | The page script: modals, tabs, steps and entrance animations. |
| `@skylivellc/lienzo-core/schema.json` | JSON Schema of the document and the site settings. |
| `@skylivellc/lienzo-core/data.json` | The style table, icons, core actions, messages and defaults. |

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled third-party material.
