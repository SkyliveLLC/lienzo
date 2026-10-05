<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

/** Markup for one core element type, twin of a function in core's `elements/*.ts`. */
interface ElementRenderer
{
    /** @param array<string, mixed> $element a parsed core element */
    public static function render(array $element, ElementContext $context): ElementNode;
}
