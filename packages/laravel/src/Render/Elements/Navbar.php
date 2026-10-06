<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;
use Skylive\Lienzo\Support\Js;

final class Navbar implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];
        $sticky = ($props['sticky'] ?? null) === true;
        $scroll = $props['scroll_style'] ?? null;
        $template = $props['template'] ?? null;
        $anchors = array_map(
            fn (array $link) => Html::h('a', $context->action($link['action']) ?? ['href' => '#'], [Html::text($link['label'])]),
            $props['links'] ?? [],
        );

        return new ElementNode('nav', 'lz-navbar', [
            'data-layout' => $props['layout'] ?? 'split',
            'data-template' => $template !== null && $template !== 'plain' ? $template : null,
            'data-sticky' => $sticky,
            'data-scroll' => $sticky && $scroll !== null && $scroll !== 'same' ? $scroll : null,
        ], [
            Js::trim($props['brand'] ?? '') !== '' ? Html::h('span', ['class' => 'lz-navbar-brand'], [Html::text($props['brand'])]) : null,
            Html::h('div', ['class' => 'lz-navbar-links'], $anchors),
            $anchors !== [] ? Html::h('details', ['class' => 'lz-navbar-menu'], [
                Html::h('summary', ['aria-label' => $context->t['menu']], [Html::text('☰')]),
                Html::h('div', ['class' => 'lz-navbar-drop'], $anchors),
            ]) : null,
        ]);
    }
}
