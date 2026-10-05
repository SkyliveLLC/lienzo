<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

final class Textarea implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        return new ElementNode('label', 'lz-field', children: [
            Parts::fieldLabel($element),
            Html::h('textarea', [
                'name' => Parts::fieldName($element),
                'placeholder' => $element['props']['placeholder'] ?? null,
                'required' => ($element['props']['required'] ?? null) === true,
            ], [Html::text($context->form?->old(Parts::fieldKey($element)) ?? '')]),
            Parts::fieldError($element, $context),
        ]);
    }
}
