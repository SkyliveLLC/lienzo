<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

final class Shape implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        return new ElementNode('div', attrs: ['aria-hidden' => 'true', 'data-shape' => $element['props']['shape'] ?? null]);
    }
}
