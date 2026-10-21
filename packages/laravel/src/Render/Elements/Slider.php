<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

/**
 * Pictures shown one at a time, on a track that scrolls and snaps. Without
 * JavaScript it is still a scrollable strip; the runtime adds the arrows, the
 * dots and the moving by itself. Pictures with nothing behind them are skipped.
 */
final class Slider implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];
        $slides = [];

        foreach ($props['images'] ?? [] as $index => $source) {
            $file = $context->media($source);

            if ($file === null) {
                continue;
            }

            $thumb = $file->thumb ?? '';
            $sized = ($file->width ?? 0) !== 0;
            $slides[] = Html::h('img', [
                'class' => 'lz-slide',
                'src' => $file->url,
                'srcset' => $thumb !== '' ? "{$thumb} 480w, {$file->url} 1800w" : null,
                'width' => $sized ? $file->width : null,
                'height' => $sized ? $file->height : null,
                'alt' => $props['alt'] ?? '',
                'loading' => $index === 0 ? null : 'lazy',
                'decoding' => 'async',
            ]);
        }

        $many = count($slides) > 1;
        $arrows = ($props['arrows'] ?? null) !== false && $many;
        $dots = ($props['dots'] ?? null) !== false && $many;
        $children = [Html::h('div', ['class' => 'lz-slider-track'], $slides)];

        if ($arrows) {
            $children[] = Html::h('button', [
                'type' => 'button', 'class' => 'lz-slider-arrow', 'data-to' => 'previous',
                'aria-label' => $context->t['previous'],
            ]);
            $children[] = Html::h('button', [
                'type' => 'button', 'class' => 'lz-slider-arrow', 'data-to' => 'next',
                'aria-label' => $context->t['next'],
            ]);
        }

        if ($dots) {
            $buttons = [];

            foreach ($slides as $index => $slide) {
                $buttons[] = Html::h('button', [
                    'type' => 'button',
                    'data-at' => (string) $index,
                    'aria-label' => str_replace('{n}', (string) ($index + 1), $context->t['slide']),
                ], [Html::text('')]);
            }

            $children[] = Html::h('div', ['class' => 'lz-slider-dots'], $buttons);
        }

        $interval = $props['interval'] ?? null;

        return new ElementNode('div', 'lz-slider', [
            'data-autoplay' => ($props['autoplay'] ?? null) === true && $many ? '' : null,
            'data-interval' => $interval === null ? null : (string) $interval,
        ], $children);
    }
}
