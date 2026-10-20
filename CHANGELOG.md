# Changelog

All notable changes to Lienzo are listed here. The three packages (`skylive/lienzo`, `@skylivellc/lienzo-core` and `@skylivellc/lienzo-editor`) share one version number. Lienzo follows [Semantic Versioning](https://semver.org). Before 1.0, a minor version can break compatibility.

## 0.10.1 (2026-10-20)

### Fixed

- A section that lays itself out kept its phone layout from working: its elements piled up on top of each other. It now flows in one column on phones too.

## 0.10.0 (2026-10-20)

### Editor

- A gallery element: pictures from the library or by address, shown as a grid of one to six columns or as a strip that scrolls sideways and snaps. A picture whose upload is gone is skipped instead of leaving a broken frame.

## 0.9.1 (2026-10-20)

### Release

- The npm step publishes from inside each package and then checks the registry really has that version. A workspace filter had published nothing while still reporting success, which is how the two packages drifted apart.

## 0.9.0 (2026-10-20)

### Rendering

- A section can lay itself out: its elements go one under the other or side by side, with a space between them and an alignment, and the section grows with what it holds. Nothing is placed by hand there, and nothing overlaps when the text gets longer.

### Release

- The npm packages are published one at a time, with a retry, and a version already on the registry is not an error. Publishing them in one recursive command hid which one failed and left the two on different versions.

## 0.8.0 (2026-10-20)

### Rendering

- A sticky navigation bar can take its own colors once the page scrolls. A bar that starts transparent over a photo used to keep its light text when it turned solid, which left an invisible band over the content.

## 0.7.0 (2026-10-20)

### Rendering

- Type can be set to a second size for phones, so a headline can be loud on a screen and still fit in a hand.
- Letters gain spacing, case (uppercase, lowercase, title case) and a face: solid, hollow or glowing.
- A box can grow with its text instead of cropping what does not fit.

## 0.6.1 (2026-10-20)

### Rendering

- A sticky navigation bar stays where it belongs on phones. The phone layout turned every element absolute, which left the bar shifted half its width off the screen.

## 0.6.0 (2026-10-20)

### Rendering

- A video background can hold still while the section scrolls over it, the way an image background already could.
- Three more looks for the navigation bar: floating, boxed links and spaced out.
- Two more entrances, coming into focus and wiping across, and three more pointer gestures: press in, tilt and glow.
- An element can move while it crosses the screen (rise, drift or zoom), driven by the scroll itself. Browsers without view timelines show it still.

## 0.5.0 (2026-10-20)

### Rendering

- A section can play a video as its background: muted, looping, with its image as the poster while it loads.
- A section can run edge to edge, dropping the theme's width, for the full-bleed pages this makes possible.

## 0.4.0 (2026-10-19)

### Editor

- The canvas scrolls again in apps that style `<lienzo-editor>` themselves. The host's `style` and classes landed on the editor's own root, where an inherited `display: block` replaced its grid, and the body grew to the height of the page instead of scrolling.
- Each section carries a chip with its name or anchor; clicking it selects the section.
- The control between sections also duplicates one, and a section with nothing in it says so on the canvas.

## 0.3.0 (2026-10-19)

### Rendering

- A link to a section now reaches it. The anchor action pointed at `#<id>` while sections render as `#s-<id>`, so every menu link did nothing. Pages keep the section identifiers they already have; only the links change.

### Editor

- The edge between two sections carries a floating control: add a section right below that one, or delete it, without leaving the canvas.

## 0.2.0 (2026-10-05)

### Editor

- Zoom and pan the canvas on its own, without zooming the page: ctrl or command with the wheel, the zoom bar, and `⌘+`, `⌘-`, `⌘0` and `⌘1`. Hold the space bar or the middle button to move the view.
- A right-click menu on the canvas with copy, paste, duplicate, order, group, lock, align, distribute and delete, so the right panel is free for the element's own settings.
- A style change with several elements selected reaches all of them, and so does a change of order.
- A pinned element stays in place while the page scrolls, keeping the spot it has inside the frame.

### Rendering

- Five looks for the navigation bar: plain, pill, card, underline and divided, with a ready-made menu for each.
- A dropdown can take several answers. It is then a list of checkboxes, and every answer is checked against the options and stored.
- A `choice` field an app declares takes `->multiple()`, which keeps every value picked as a list.

## 0.1.1 (2026-10-05)

The first release on npm. The npm packages are published under the `@skylivellc` scope as `@skylivellc/lienzo-core` and `@skylivellc/lienzo-editor`. Version 0.1.0 was only released on Packagist. For Composer users, 0.1.1 is the same as 0.1.0.

## 0.1.0 (2026-10-05)

The first release.

### Editor

- A free-form canvas with drag, resize, rotate, snapping guides, multi-select, alignment, undo and redo, and keyboard shortcuts.
- Thirteen element types: heading, text, image, button, divider, video, shape, icon, navigation bar, and the text field, long text field, dropdown and checkbox form fields.
- Ready-made sections and page templates, tabs and steps groups, and modals.
- A separate phone layout, generated from the desktop one and then edited on its own.
- A media library with uploads, site settings, a theme editor, published versions with restore, and a reader for form messages.
- Autosave with conflict detection, so two open tabs never overwrite each other.
- English and Spanish interface strings, with overrides per key.
- Ships as a Vue 3 component, a `<lienzo-editor>` custom element and a standalone ES module with Vue inside.

### Rendering

- A JSON document format with one schema for TypeScript and PHP. Elements of unknown types are kept, never dropped.
- A TypeScript renderer in `@skylivellc/lienzo-core` and a native PHP renderer in `skylive/lienzo` that produce byte-identical HTML, checked by golden files.
- One static stylesheet and a small page script. Container queries make the phone layout and the editor's phone frame the same code path.
- App elements that render live data from the backend, app actions, and app site fields.

### Laravel

- `php artisan lienzo:install`, `Route::lienzoEditor()`, `Route::lienzo()` and `<x-lienzo::editor>`. Both route macros also work inside a group with parameters of its own, such as `Route::domain('{tenant}')`.
- `Lienzo::editorScriptUrl()`, for Inertia and single-page apps that render `<lienzo-editor>` themselves.
- Sites owned by any model, or one default site.
- Uploads re-encoded to WebP with thumbnails, sanitized SVG, quotas, and images that stay private until a published page uses them.
- Form submissions validated against the published form, with CSRF, a honeypot and rate limiting. Checkbox answers are stored as booleans, and the editor's inbox words them in its own language. The form replies `sent` and `formUnavailable` come in English and Spanish and can be overridden with `Lienzo::messages()`.
- `sitemap.xml` and `robots.txt`. `lienzo:install` removes Laravel's stock `public/robots.txt`, which would hide Lienzo's.

### Examples

- `examples/laravel`: a Laravel 13 app set up with the README steps.
- `examples/vanilla`: the same features on Node's `node:http`, with no framework.
