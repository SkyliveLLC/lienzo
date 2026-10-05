<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

final class Text implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        return new ElementNode('p', children: [Parts::accented($element)]);
    }
}
