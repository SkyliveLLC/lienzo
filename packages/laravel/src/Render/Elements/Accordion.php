<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

/**
 * Questions that fold. Built on `details`, so one opens without JavaScript,
 * the browser finds the text when someone searches the page, and a reader
 * that cannot see still hears what is folded.
 */
final class Accordion implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $folds = [];

        foreach ($element['props']['items'] ?? [] as $item) {
            $folds[] = Html::h('details', ['class' => 'lz-fold'], [
                Html::h('summary', [], [Html::text($item['title'])]),
                Html::h('p', [], [Html::text($item['text'] ?? '')]),
            ]);
        }

        return new ElementNode('div', 'lz-accordion', [], $folds);
    }
}
