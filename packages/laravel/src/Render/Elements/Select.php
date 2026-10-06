<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;

final class Select implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $props = $element['props'];
        $options = $props['options'] ?? [];
        $key = Parts::fieldKey($element);

        // Several answers: a list of checkboxes, because a native multiple select
        // is hard to use on a phone. One answer: the dropdown.
        if (($props['multiple'] ?? null) === true) {
            $chosen = [];

            foreach (array_keys($options) as $index) {
                $value = $context->form?->old($key.'.'.$index);

                if ($value !== null) {
                    $chosen[$value] = true;
                }
            }

            return new ElementNode('div', 'lz-field lz-choices', children: [
                Parts::fieldLabel($element),
                Html::h('div', ['class' => 'lz-choices-list'], array_map(
                    fn (string $option) => Html::h('label', [], [
                        Html::h('input', ['type' => 'checkbox', 'name' => Parts::fieldName($element).'[]', 'value' => $option, 'checked' => isset($chosen[$option])]),
                        Html::h('span', [], [Html::text($option)]),
                    ]),
                    $options,
                )),
                Parts::fieldError($element, $context),
            ]);
        }

        $old = $context->form?->old($key);
        $placeholder = $props['placeholder'] ?? '';

        return new ElementNode('label', 'lz-field', children: [
            Parts::fieldLabel($element),
            Html::h('select', ['name' => Parts::fieldName($element), 'required' => ($props['required'] ?? null) === true], [
                Html::h('option', ['value' => ''], [Html::text($placeholder !== '' ? $placeholder : $context->t['choose'])]),
                ...array_map(
                    fn (string $option) => Html::h('option', ['value' => $option, 'selected' => $old === $option], [Html::text($option)]),
                    $options,
                ),
            ]),
            Parts::fieldError($element, $context),
        ]);
    }
}
