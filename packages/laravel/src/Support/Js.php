<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Support;

/**
 * JavaScript string semantics the shared contract is written in. Core is
 * TypeScript, so trimming, `\s`, number-to-string and JSON spelling follow
 * JavaScript; these helpers make PHP agree byte for byte.
 */
final class Js
{
    /** JavaScript's `\s` and `trim()` set, for use inside a PCRE character class (with the `u` flag). */
    public const string SPACE = '\t\n\x{0B}\f\r \x{A0}\x{1680}\x{2000}-\x{200A}\x{2028}\x{2029}\x{202F}\x{205F}\x{3000}\x{FEFF}';

    /** @var array<string, string> */
    private static array $patterns = [];

    /** `String.prototype.trim`. PHP's trim() knows only ASCII whitespace and also strips NUL. */
    public static function trim(string $value): string
    {
        return preg_replace('/^['.self::SPACE.']+|['.self::SPACE.']+$/uD', '', $value) ?? $value;
    }

    /**
     * Compiles a JSON Schema (ECMA-262) pattern for preg_*: `\s` becomes
     * JavaScript's set rather than Unicode White_Space, and `$` matches only
     * at the very end, never before a trailing newline.
     */
    public static function pattern(string $source): string
    {
        return self::$patterns[$source] ??= self::translate($source);
    }

    /**
     * `String(number)` without the exponent form: the shortest decimal that
     * reads back as the same double.
     */
    public static function decimal(int|float $value): string
    {
        if (is_int($value)) {
            return (string) $value;
        }

        [$digits, $exponent] = self::shortest($value);
        $sign = $value < 0 && $digits !== '0' ? '-' : '';

        if ($exponent < 0) {
            return $sign.'0.'.str_repeat('0', -$exponent - 1).$digits;
        }

        $digits = str_pad($digits, $exponent + 1, '0');
        $fraction = substr($digits, $exponent + 1);

        return $sign.substr($digits, 0, $exponent + 1).($fraction === '' ? '' : '.'.$fraction);
    }

    /**
     * `JSON.stringify` for decoded JSON: same spelling of numbers (`1e-7`,
     * `0`, `null` for a non-finite one), strings and containers. PHP's
     * json_encode spells some numbers differently.
     */
    public static function stringify(mixed $value): string
    {
        return match (true) {
            is_array($value) && array_is_list($value) => '['.implode(',', array_map(self::stringify(...), $value)).']',
            is_array($value) => '{'.implode(',', array_map(
                fn (int|string $key, mixed $item): string => self::stringify((string) $key).':'.self::stringify($item),
                array_keys($value),
                $value,
            )).'}',
            is_int($value) && abs($value) <= 2 ** 53 => (string) $value,
            is_int($value), is_float($value) => self::numberToString((float) $value),
            default => (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_LINE_TERMINATORS),
        };
    }

    /** `Number.prototype.toString()`, with JSON's `null` for a non-finite number. */
    private static function numberToString(float $value): string
    {
        if (! is_finite($value)) {
            return 'null';
        }

        [$digits, $exponent] = self::shortest($value);

        if ($digits === '0') {
            return '0';
        }

        $sign = $value < 0 ? '-' : '';

        if ($exponent >= -6 && $exponent < 21) {
            return self::decimal($value);
        }

        $mantissa = strlen($digits) > 1 ? $digits[0].'.'.substr($digits, 1) : $digits;

        return $sign.$mantissa.'e'.($exponent < 0 ? '-' : '+').abs($exponent);
    }

    /**
     * The shortest digits that read back as the same double, and the power of ten of the first one.
     *
     * @return array{0: string, 1: int}
     */
    private static function shortest(float $value): array
    {
        if ($value == 0) {
            return ['0', 0];
        }

        for ($precision = 0; $precision < 17; $precision++) {
            $scientific = sprintf("%.{$precision}e", abs($value));

            if ((float) $scientific === abs($value)) {
                break;
            }
        }

        preg_match('/^(\d)(?:\.(\d+))?e([+-]\d+)$/', $scientific, $match);

        return [$match[1].($match[2] ?? ''), (int) $match[3]];
    }

    private static function translate(string $source): string
    {
        $pattern = '';
        $inClass = false;
        $length = strlen($source);

        for ($index = 0; $index < $length; $index++) {
            $char = $source[$index];

            if ($char === '\\' && $index + 1 < $length) {
                $next = $source[++$index];
                $pattern .= match (true) {
                    $next !== 's' => '\\'.$next,
                    $inClass => self::SPACE,
                    default => '['.self::SPACE.']',
                };

                continue;
            }

            $inClass = match ($char) {
                '[' => true,
                ']' => false,
                default => $inClass,
            };
            $pattern .= $char === '/' ? '\/' : $char;
        }

        return '/'.$pattern.'/uD';
    }
}
