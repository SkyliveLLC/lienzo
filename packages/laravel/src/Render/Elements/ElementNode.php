<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\TrustedHtml;

/** An element's root node. The renderer adds id, class `lz-el`, the style projection and the vars block. */
final readonly class ElementNode
{
    /**
     * @param  array<string, string|int|float|bool|null>  $attrs
     * @param  list<TrustedHtml|null|false>  $children
     */
    public function __construct(
        public string $tag,
        public ?string $class = null,
        public array $attrs = [],
        public array $children = [],
    ) {}
}
