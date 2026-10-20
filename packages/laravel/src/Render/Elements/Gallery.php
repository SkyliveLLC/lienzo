<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

/**
 * A row of pictures: a grid that wraps, or a strip that scrolls sideways and
 * snaps. Pictures with nothing behind them are skipped, so a deleted upload
 * leaves a shorter gallery instead of a broken frame.
 */
final class Gallery implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];
        $pictures = [];

        foreach ($props['images'] ?? [] as $source) {
            $file = $context->media($source);

            if ($file === null) {
                continue;
            }

            $thumb = $file->thumb ?? '';
            $sized = ($file->width ?? 0) !== 0;
            $pictures[] = Html::h('img', [
                'class' => 'lz-gallery-item',
                'src' => $file->url,
                'srcset' => $thumb !== '' ? "{$thumb} 480w, {$file->url} 1800w" : null,
                'width' => $sized ? $file->width : null,
                'height' => $sized ? $file->height : null,
                'alt' => $props['alt'] ?? '',
                'loading' => 'lazy',
                'decoding' => 'async',
            ]);
        }

        return new ElementNode('div', 'lz-gallery', [
            'data-layout' => ($props['layout'] ?? null) === 'strip' ? 'strip' : 'grid',
            'data-cols' => (string) ($props['columns'] ?? 3),
        ], $pictures);
    }
}
