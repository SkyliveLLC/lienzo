<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use Stringable;

/**
 * Markup that is safe to emit as-is: built by the serializer or by developer
 * code (an app element, a head hook). Never wrap user input in one.
 */
final readonly class TrustedHtml implements Stringable
{
    public function __construct(public string $html) {}

    public function __toString(): string
    {
        return $this->html;
    }
}
