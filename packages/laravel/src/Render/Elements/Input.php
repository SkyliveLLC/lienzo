<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

final class Input implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        return new ElementNode('label', 'lz-field', children: [
            Parts::fieldLabel($element),
            Html::h('input', [
                'type' => $element['props']['input_type'] ?? 'text',
                'name' => Parts::fieldName($element),
                'value' => $context->form?->old(Parts::fieldKey($element)),
                'placeholder' => $element['props']['placeholder'] ?? null,
                'required' => ($element['props']['required'] ?? null) === true,
            ]),
            Parts::fieldError($element, $context),
        ]);
    }
}
