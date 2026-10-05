<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

/**
 * An empty source or a deleted `media:<id>` renders `src=""`: no request, and
 * the browser shows the alt text instead of a broken reference.
 */
final class Image implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $file = $context->media($element['props']['src'] ?? null);
        $thumb = $file?->thumb ?? '';
        $sized = ($file?->width ?? 0) !== 0;

        return new ElementNode('img', attrs: [
            'src' => $file->url ?? '',
            'srcset' => $thumb !== '' ? "{$thumb} 480w, {$file->url} 1800w" : null,
            'sizes' => $thumb !== '' ? '(max-width: 640px) 100vw, '.(int) $element['layout']['desktop']['w'].'vw' : null,
            'width' => $sized ? $file->width : null,
            'height' => $sized ? $file->height : null,
            'alt' => $element['props']['alt'] ?? '',
            'loading' => 'lazy',
            'decoding' => 'async',
            'data-shape' => $element['props']['shape'] ?? null,
        ]);
    }
}
