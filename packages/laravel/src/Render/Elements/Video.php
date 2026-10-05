<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

final class Video implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $embed = self::embed($element['props']['url'] ?? '');

        return new ElementNode('div', 'lz-video', children: [$embed === null ? null : Html::h('iframe', [
            'src' => $embed,
            'title' => $element['props']['alt'] ?? $context->t['video'],
            'loading' => 'lazy',
            'allowfullscreen' => true,
        ])]);
    }

    /** YouTube and Vimeo links become their privacy-friendly embed URL; anything else embeds nothing. */
    public static function embed(string $url): ?string
    {
        if (preg_match('#youtu(?:\.be/|be\.com/(?:watch\?v=|embed/))([A-Za-z0-9_-]{6,20})#', $url, $youtube) === 1) {
            return "https://www.youtube-nocookie.com/embed/{$youtube[1]}";
        }

        return preg_match('#vimeo\.com/(?:video/)?([0-9]{6,12})#', $url, $vimeo) === 1 ? "https://player.vimeo.com/video/{$vimeo[1]}" : null;
    }
}
