<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use Skylive\Lienzo\Assets;

/**
 * Projects a parsed style bag through core's style table (`data.json`): a
 * `var` rule becomes a custom property in the element's vars block, an `attr`
 * rule a `data-*` attribute. `lienzo.css` consumes both.
 */
final class Style
{
    /**
     * In table order, like core's `projectStyle`.
     *
     * @param  array<string, mixed>  $style
     * @return array{vars: list<array{0: string, 1: string}>, attrs: array<string, string|true>}
     */
    public static function project(array $style): array
    {
        $projection = ['vars' => [], 'attrs' => []];

        foreach (Assets::data()['styleTable'] as $key => $rule) {
            $value = $style[$key] ?? null;

            if ($value === null) {
                continue;
            }

            if (! isset($rule['group'])) {
                self::apply($rule, $value, $projection);

                continue;
            }

            foreach ($rule['requires'] ?? [] as $sub) {
                if (! isset($value[$sub])) {
                    continue 2;
                }
            }

            foreach ($rule['group'] as $sub => $leaf) {
                self::apply($leaf, $value[$sub] ?? null, $projection);
            }
        }

        return $projection;
    }

    /** Theme tokens stay variables so the page follows palette changes. Parse guarantees a token or `#rrggbb`. */
    public static function color(string $value): string
    {
        return in_array($value, Assets::data()['themeTokens'], true) ? "var(--{$value})" : $value;
    }

    /**
     * @param  array<string, mixed>  $rule
     * @param  array{vars: list<array{0: string, 1: string}>, attrs: array<string, string|true>}  $projection
     */
    private static function apply(array $rule, mixed $value, array &$projection): void
    {
        if (isset($rule['var'])) {
            if ($rule['kind'] === 'color' && is_string($value)) {
                $projection['vars'][] = [$rule['var'], self::color($value)];
            } elseif ($rule['kind'] === 'num' && (is_int($value) || is_float($value)) && ! (isset($rule['skip']) && $value == $rule['skip'])) {
                $projection['vars'][] = [$rule['var'], Html::num($value)];
            }

            return;
        }

        if ($rule['kind'] === 'flag') {
            if ($value === true) {
                $projection['attrs']["data-{$rule['attr']}"] = true;
            }

            return;
        }

        $resolved = $value ?? $rule['default'] ?? null;

        if (is_string($resolved) && $resolved !== ($rule['skip'] ?? null)) {
            $projection['attrs']["data-{$rule['attr']}"] = $resolved;
        }
    }
}
