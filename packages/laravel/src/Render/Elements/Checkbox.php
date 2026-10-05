<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

final class Checkbox implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $old = $context->form?->old(Parts::fieldKey($element)) ?? '';

        return new ElementNode('label', 'lz-field lz-field-check', children: [
            Html::h('input', [
                'type' => 'checkbox',
                'name' => Parts::fieldName($element),
                'value' => '1',
                'checked' => $old !== '',
                'required' => ($element['props']['required'] ?? null) === true,
            ]),
            Parts::fieldLabel($element),
            Parts::fieldError($element, $context),
        ]);
    }
}
