# Lienzo on plain Node

This example hosts Lienzo with Node's `node:http` module and nothing else: no framework and no bundler. It shows that any backend that implements the protocol in `@skylive/lienzo-core/protocol` can run the editor and serve the published pages.

`server.ts` is the whole backend:

- `/api` implements every protocol route. Core's `parseDocument`, `parseSiteSettings`, `parseFields`, and `parseSeo` validate what the editor sends.
- `/admin` serves an HTML page with `<lienzo-editor endpoint="/api">`, loaded from the editor's prebuilt `@skylive/lienzo-editor/standalone` bundle.
- `/` and `/<slug>` render published pages with core's `renderPage`. Forms post to `/submit`, which checks the fields against the published page and stores the message.
- `/media/<id>`, `/sitemap.xml`, and `/robots.txt` serve what visitors and search engines read. An image is public only after a published page uses it.

The app registers one element, one action, and one site field. The **Latest posts** element renders the app's own posts on every request, so a new post shows on the live page without a republish. The **Call the site phone** action links to the phone number set in the site settings.

State lives in `store.json` and the uploaded files, in `.data/` next to `server.ts`. Set `LIENZO_DATA` to use another directory.

## Run it

Run these commands from the repository root:

```sh
pnpm install && pnpm build && pnpm --filter lienzo-example-vanilla start
```

Open <http://localhost:3000/admin>. The site has no pages yet, so the editor asks you to create one. Leave the address empty to create the home page. After you publish it, the page is at <http://localhost:3000/>.

Set `PORT` to listen on another port. If visitors reach the site at another address, set `PUBLIC_URL` to it. Sitemap entries and canonical links use that address.

## Run the end-to-end test

The test starts the server on port 4317 with an empty data directory. It builds a page in the editor, publishes it, reads it and fills its form as a visitor, and then finds the message in the editor.

```sh
pnpm build && pnpm --filter lienzo-example-vanilla e2e
```

If Playwright has no Chromium yet, run `pnpm --filter lienzo-example-vanilla exec playwright install chromium` first.

## Before you deploy

The example has no login, and it listens on `127.0.0.1` only. In a real deployment, put every path under `/admin` and `/api` behind your own authentication. Leave `/`, `/submit`, `/media`, `/sitemap.xml`, and `/robots.txt` public.
