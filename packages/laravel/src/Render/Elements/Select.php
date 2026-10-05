<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

final class Select implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];
        $old = $context->form?->old(Parts::fieldKey($element));
        $placeholder = $props['placeholder'] ?? '';

        return new ElementNode('label', 'lz-field', children: [
            Parts::fieldLabel($element),
            Html::h('select', ['name' => Parts::fieldName($element), 'required' => ($props['required'] ?? null) === true], [
                Html::h('option', ['value' => ''], [Html::text($placeholder !== '' ? $placeholder : $context->t['choose'])]),
                ...array_map(
                    fn (string $option) => Html::h('option', ['value' => $option, 'selected' => $old === $option], [Html::text($option)]),
                    $props['options'] ?? [],
                ),
            ]),
            Parts::fieldError($element, $context),
        ]);
    }
}
