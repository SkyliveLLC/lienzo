<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Render\Html;
use Skylive\Lienzo\Render\TrustedHtml;

final class Icon implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];
        $svg = self::svg($props['icon'] ?? 'star', $props['stroke'] ?? 2);
        $link = $context->action($props['action'] ?? null);

        return $link !== null
            ? new ElementNode('a', 'lz-icon', [...$link, 'aria-label' => $props['label'] ?? $props['icon'] ?? $context->t['icon']], [$svg])
            : new ElementNode('span', 'lz-icon', children: [$svg]);
    }

    /** Lucide strokes (ISC license). Inherits color and size from its box. */
    public static function svg(string $name, int|float $stroke): TrustedHtml
    {
        $nodes = array_map(fn (array $node): TrustedHtml => Html::h($node[0], $node[1]), Assets::data()['icons'][$name] ?? []);

        return Html::h('svg', [
            'viewBox' => '0 0 24 24',
            'fill' => 'none',
            'stroke' => 'currentColor',
            'stroke-width' => $stroke,
            'stroke-linecap' => 'round',
            'stroke-linejoin' => 'round',
            'aria-hidden' => 'true',
        ], $nodes);
    }
}
