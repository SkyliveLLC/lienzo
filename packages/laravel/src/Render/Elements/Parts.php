<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Canvas;
use Skylive\Lienzo\Render\Html;
use Skylive\Lienzo\Render\TrustedHtml;
use Skylive\Lienzo\Support\Js;

/** Pieces several element renderers share. */
final class Parts
{
    /**
     * Text with one part in the accent color, for two-tone headings.
     *
     * @param  array<string, mixed>  $element
     */
    public static function accented(array $element): TrustedHtml
    {
        $content = $element['props']['text'] ?? '';
        $part = Js::trim($element['props']['accent'] ?? '');
        $at = $part === '' || ($element['style']['accent_color'] ?? '') === '' ? false : strpos($content, $part);

        if ($at === false) {
            return Html::text($content);
        }

        return Html::fragment([
            Html::text(substr($content, 0, $at)),
            Html::h('span', ['class' => 'lz-accent'], [Html::text($part)]),
            Html::text(substr($content, $at + strlen($part))),
        ]);
    }

    /**
     * Label row shared by every form field: the text and a required mark.
     *
     * @param  array<string, mixed>  $element
     */
    public static function fieldLabel(array $element): TrustedHtml
    {
        return Html::h('span', [], [
            Html::text(Js::trim($element['props']['label'] ?? '')),
            ($element['props']['required'] ?? null) === true ? Html::h('i', [], [Html::text('*')]) : null,
        ]);
    }

    /** @param array<string, mixed> $element */
    public static function fieldKey(array $element): string
    {
        return 'fields.'.Canvas::safeId($element['id']);
    }

    /** @param array<string, mixed> $element */
    public static function fieldName(array $element): string
    {
        return 'fields['.Canvas::safeId($element['id']).']';
    }

    /** @param array<string, mixed> $element */
    public static function fieldError(array $element, ElementContext $context): ?TrustedHtml
    {
        $message = $context->form?->error(self::fieldKey($element));

        return $message === null ? null : Html::h('em', ['class' => 'lz-field-error'], [Html::text($message)]);
    }
}
