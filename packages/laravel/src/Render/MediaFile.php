<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

/** A resolved image: its URL, an optional 480px thumbnail and its pixel size when known. */
final readonly class MediaFile
{
    public function __construct(
        public string $url,
        public ?string $thumb = null,
        public ?int $width = null,
        public ?int $height = null,
    ) {}
}
