<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

/** What `Renderer::renderPage` returns: the complete document plus its parts for a host that owns its layout. */
final readonly class RenderedPage
{
    /**
     * @param  list<array{name?: string, property?: string, content: string}>  $meta
     * @param  list<array{rel: string, href: string, crossorigin?: true}>  $links
     */
    public function __construct(
        public string $lang,
        public string $title,
        public array $meta,
        public array $links,
        /** Theme variables, one `#id{--var:..}` block per section, modal and element, and app element CSS. Never a URL. */
        public string $css,
        /** Page content. A host that owns its layout puts it inside an element with class `lz-page`, next to `lienzo.css` and `runtime.js`. */
        public TrustedHtml $body,
        public ?TrustedHtml $head,
        /** The complete document, with `lienzo.css` and `runtime.js` inlined. */
        public string $html,
    ) {}
}
