<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use LogicException;
use Skylive\Lienzo\Support\Js;

/**
 * The serializer every byte of public markup passes through, twin of core's
 * `html.ts`. Canonical output: attributes sorted by name, no whitespace
 * between tags, numbers through `num`, text escaped by htmlspecialchars.
 *
 * @phpstan-type Attrs array<string, string|int|float|bool|null>
 * @phpstan-type Child TrustedHtml|null|false
 */
final class Html
{
    /** Every tag the renderer may emit. */
    private const array TAGS = [
        'a', 'button', 'circle', 'details', 'dialog', 'div', 'em', 'form', 'h1', 'h2', 'h3', 'h4', 'hr', 'i',
        'iframe', 'img', 'input', 'label', 'line', 'link', 'meta', 'nav', 'option', 'p', 'path', 'rect',
        'section', 'select', 'span', 'summary', 'svg', 'textarea',
    ];

    private const array VOID = ['hr', 'img', 'input', 'link', 'meta'];

    private const array URL_ATTRIBUTES = ['action', 'href', 'src'];

    /** An empty URL is allowed: it is how an image with nothing to show says so. */
    private const string SAFE_URL = '/^(https?:\/\/|mailto:|tel:|\/|#|$)/D';

    public static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML401, 'UTF-8');
    }

    public static function text(string $value): TrustedHtml
    {
        return new TrustedHtml(self::escape($value));
    }

    /**
     * One element. `true` renders a bare attribute, `false`/null drop it. URL
     * attributes must use an allowed scheme: a violation is a renderer bug and throws.
     *
     * @param  Attrs  $attrs
     * @param  list<Child>  $children
     */
    public static function h(string $tag, array $attrs = [], array $children = []): TrustedHtml
    {
        if (! in_array($tag, self::TAGS, true)) {
            throw new LogicException("Refusing tag {$tag}");
        }

        ksort($attrs, SORT_STRING);
        $html = "<{$tag}";

        foreach ($attrs as $name => $value) {
            if ($value === false || $value === null) {
                continue;
            }

            $name = (string) $name;

            if (preg_match('/^[a-zA-Z][a-zA-Z0-9-]*$/D', $name) !== 1) {
                throw new LogicException('Refusing attribute name '.json_encode($name));
            }

            if ($value === true) {
                $html .= " {$name}";

                continue;
            }

            $text = is_string($value) ? $value : self::num($value);
            self::assertSafeUrl($name, $text);
            $html .= " {$name}=\"".self::escape($text).'"';
        }

        if (in_array($tag, self::VOID, true)) {
            return new TrustedHtml("{$html}>");
        }

        return new TrustedHtml("{$html}>".self::fragment($children)."</{$tag}>");
    }

    /** @param list<Child> $children */
    public static function fragment(array $children): TrustedHtml
    {
        return new TrustedHtml(implode('', array_map(fn (TrustedHtml|false|null $child): string => $child?->html ?? '', $children)));
    }

    /**
     * Canonical number: the shortest round-trip decimal, rounded half away
     * from zero to 3 decimals, trailing zeros stripped. Rounding works on the
     * decimal digits, not on binary floats, so 1.0005 becomes 1.001 here and in core.
     */
    public static function num(int|float $value): string
    {
        if (is_float($value) && ! is_finite($value)) {
            throw new LogicException("Refusing non-finite number {$value}");
        }

        [$whole, $fraction] = explode('.', Js::decimal(abs($value))) + [1 => ''];
        $digits = $whole.str_pad(substr($fraction, 0, 3), 3, '0');

        if (($fraction[3] ?? '0') >= '5') {
            $digits = self::increment($digits);
        }

        $integer = ltrim(substr($digits, 0, -3), '0');
        $decimals = rtrim(substr($digits, -3), '0');
        $result = ($integer === '' ? '0' : $integer).($decimals === '' ? '' : ".{$decimals}");

        return $value < 0 && $result !== '0' ? "-{$result}" : $result;
    }

    private static function increment(string $digits): string
    {
        for ($index = strlen($digits) - 1; $index >= 0; $index--) {
            if ($digits[$index] !== '9') {
                $digits[$index] = (string) ((int) $digits[$index] + 1);

                return $digits;
            }

            $digits[$index] = '0';
        }

        return "1{$digits}";
    }

    private static function assertSafeUrl(string $name, string $value): void
    {
        if ($name === 'srcset') {
            foreach (explode(',', $value) as $candidate) {
                self::assertSafeUrl('src', preg_split('/['.Js::SPACE.']+/u', Js::trim($candidate))[0] ?? '');
            }

            return;
        }

        if (in_array($name, self::URL_ATTRIBUTES, true) && preg_match(self::SAFE_URL, $value) !== 1) {
            throw new LogicException("Refusing {$name}=".json_encode($value));
        }
    }
}
