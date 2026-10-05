<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

final class Button implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];

        return ($props['action']['type'] ?? null) === 'submit'
            ? new ElementNode('button', attrs: ['type' => 'submit'], children: [Html::text($props['label'] ?? $context->t['submit'])])
            : new ElementNode('a', attrs: $context->action($props['action'] ?? null) ?? [], children: [Html::text($props['label'] ?? '')]);
    }
}
