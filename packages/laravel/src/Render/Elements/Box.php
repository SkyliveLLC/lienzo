<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

/**
 * A box lays out what it holds instead of placing it by hand: one under the
 * other, or side by side, with a gap. The renderer fills in the children,
 * because only it knows how to draw an element.
 */
final class Box implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];

        return new ElementNode('div', 'lz-box', [
            'data-flow' => ($props['flow'] ?? null) === 'row' ? 'row' : 'column',
            'data-flow-align' => $props['flow_align'] ?? 'start',
        ]);
    }
}
