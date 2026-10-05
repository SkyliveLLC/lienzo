# @skylivellc/lienzo-editor

The visual editor of [Lienzo](https://github.com/SkyliveLLC/lienzo), an open-source landing page builder. Admins place headings, images, forms and your app's own elements on a free-form canvas, with a separate phone layout, then publish. The canvas renders through `@skylivellc/lienzo-core` in an iframe, so it shows the same markup and styles visitors get, and your app's CSS cannot leak into it.

The editor talks to a backend over the Lienzo protocol. The Laravel package `skylive/lienzo` implements it and ships this editor prebuilt, so Laravel apps do not install this package. For other backends, see [Other backends](https://github.com/SkyliveLLC/lienzo#other-backends).

The editor comes in three forms. Pick the one that matches your frontend.

## Use it as a Vue 3 component

```sh
npm install @skylivellc/lienzo-editor vue
```

```vue
<script setup lang="ts">
import { LienzoEditor } from '@skylivellc/lienzo-editor';
</script>

<template>
	<LienzoEditor endpoint="/admin/site/1" locale="en" style="height: 100vh" />
</template>
```

## Use it as a custom element with your bundler

`@skylivellc/lienzo-editor/element` registers `<lienzo-editor>`. Install `vue` next to it, as for the component, because your bundler resolves it. The editor renders in a shadow root, so page CSS does not reach it.

```ts
import '@skylivellc/lienzo-editor/element';
```

```html
<lienzo-editor endpoint="/admin/site/1" locale="en" style="display: block; height: 100vh"></lienzo-editor>
```

## Use the standalone file with no build step

`@skylivellc/lienzo-editor/standalone` is one ES module with Vue and the editor's CSS inside. The file is `dist/standalone/lienzo-editor.js` in the package. Serve it as a static file and load it with a script tag:

```html
<script type="module" src="/assets/lienzo-editor.js"></script>
<lienzo-editor endpoint="/api/lienzo" style="display: block; height: 100vh"></lienzo-editor>
```

## Options

| Option | Type | Description |
| --- | --- | --- |
| `endpoint` | `string` | Base URL of the protocol routes. Required. |
| `locale` | `string` | Language of the editor. English (`en`) and Spanish (`es`) ship. Defaults to `en`. |
| `messages` | `Record<locale, Partial<Messages>>` | Strings to add or override, by locale. Missing keys fall back to English. |
| `headers` | `Record<string, string>` | Extra request headers, such as a bearer token. |
| `fetch` | `typeof fetch` | A fetch implementation to use instead of the global one. |

On the custom element, `endpoint` and `locale` are attributes. `messages`, `headers` and `fetch` are properties: set them before you attach the element, because the editor reads them once.

Requests send cookies for the same origin. If the page has Laravel's `XSRF-TOKEN` cookie, the editor sends it back as the `X-XSRF-TOKEN` header, so session-authenticated Laravel backends need no extra setup.

## License

MIT. The standalone file includes Vue, Zod and Lucide icons. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
