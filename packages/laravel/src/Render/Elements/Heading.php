<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

final class Heading implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        return new ElementNode(['h1', 'h2', 'h3', 'h4'][($element['props']['level'] ?? 2) - 1] ?? 'h2', children: [Parts::accented($element)]);
    }
}
