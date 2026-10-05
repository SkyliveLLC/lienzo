<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Support;

/**
 * JavaScript string semantics the shared contract is written in. Core is
 * TypeScript, so trimming, `\s` and number-to-string follow
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

        if ($value == 0) {
            return '0';
        }

        for ($precision = 0; $precision < 17; $precision++) {
            $scientific = sprintf("%.{$precision}e", abs($value));

            if ((float) $scientific === abs($value)) {
                break;
            }
        }

        preg_match('/^(\d)(?:\.(\d+))?e([+-]\d+)$/', $scientific, $match);
        $digits = $match[1].($match[2] ?? '');
        $exponent = (int) $match[3];
        $sign = $value < 0 ? '-' : '';

        if ($exponent < 0) {
            return $sign.'0.'.str_repeat('0', -$exponent - 1).$digits;
        }

        $digits = str_pad($digits, $exponent + 1, '0');
        $fraction = substr($digits, $exponent + 1);

        return $sign.substr($digits, 0, $exponent + 1).($fraction === '' ? '' : '.'.$fraction);
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
