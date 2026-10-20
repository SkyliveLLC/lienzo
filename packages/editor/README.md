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

When the editor leaves the page, it sends the edits it has not saved yet. It sends writes under about 60 KB with `keepalive`, so they still arrive after the page is gone. A custom `fetch` must pass that option on. If the unsaved draft is bigger, the browser asks the user before leaving.

## Add your own controls to the toolbar

The `toolbar-start` slot puts your own controls, such as a link back to your app, at the start of the toolbar. It shows while the editor loads, when the editor fails to load, and once it is ready, so the way out never disappears.

On the custom element, `toolbar-start` is a native slot. The link stays in your page's DOM, so your CSS applies to it and your router sees the click:

```html
<lienzo-editor endpoint="/admin/site/1" style="display: block; height: 100vh">
	<a slot="toolbar-start" href="/admin">Back</a>
</lienzo-editor>
```

On the Vue component, `toolbar-start` is a named slot:

```vue
<LienzoEditor endpoint="/admin/site/1" style="height: 100vh">
	<template #toolbar-start><RouterLink to="/admin">Back</RouterLink></template>
</LienzoEditor>
```

## License

MIT. The standalone file includes Vue, Zod and Lucide icons. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
