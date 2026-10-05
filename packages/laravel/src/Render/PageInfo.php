<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

/** The page being rendered. */
final readonly class PageInfo
{
    /** @param array{title?: ?string, description?: ?string} $seo */
    public function __construct(
        public string $slug,
        public array $seo,
        /** Absolute canonical URL. */
        public string $url,
    ) {}
}
