<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Document;

use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Support\Js;

/**
 * Walks the JSON Schema subset in `dist/schema.json` the way core's zod parse
 * runs: unknown keys are dropped, `x-blank-as-null` turns a blank string into
 * null, and issues come out in the same order with the same codes.
 *
 * Each failure carries zod's `continue` flag, which decides what else is
 * reported: true for a failed length, range or pattern (checking goes on),
 * null for a wrong type or enum (the value is aborted), false for a float
 * where an integer belongs (aborted explicitly, which also stops the size
 * check of an enclosing array). A failed
 * type or enum aborts its value; a failed length, range or pattern does not,
 * which decides how unions report (as zod does).
 *
 * A PHP array is a JSON array when it is a list and an object otherwise. `[]`
 * is both, which is the empty-container rule the schema states.
 */
final class Schema
{
    private const int MAX_SAFE_INTEGER = 9007199254740991;

    /**
     * The checked and stripped value.
     *
     * @param  array<string, mixed>  $node  a schema node, e.g. `Schema::ref('CoreProps')`
     * @param  list<string|int>  $path  where `$value` sits, for issue paths
     *
     * @throws DocumentError
     */
    public static function check(array $node, mixed $value, array $path = []): mixed
    {
        [$checked, $failures] = self::walk($node, $value, $path);

        if ($failures !== []) {
            throw new DocumentError(array_column($failures, 0));
        }

        return $checked;
    }

    /** @return array{'$ref': string} */
    public static function ref(string $definition): array
    {
        return ['$ref' => "#/\$defs/{$definition}"];
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  list<string|int>  $path
     * @return array{0: mixed, 1: list<array{0: Issue, 1: ?bool}>} the value and its failures, each with zod's `continue` flag
     */
    private static function walk(array $node, mixed $value, array $path): array
    {
        if (($node['x-blank-as-null'] ?? false) === true && is_string($value) && Js::trim($value) === '') {
            $value = null;
        }

        if (isset($node['$ref'])) {
            return self::walk(self::resolve($node['$ref']), $value, $path);
        }

        if (isset($node['anyOf'])) {
            return self::anyOf($node['anyOf'], $value, $path);
        }

        if (array_key_exists('enum', $node) || array_key_exists('const', $node)) {
            $allowed = $node['enum'] ?? [$node['const']];

            foreach ($allowed as $option) {
                if (self::same($option, $value)) {
                    return [$value, []];
                }
            }

            return self::fail($value, $path, IssueCode::Enum, 'Expected one of '.json_encode($allowed));
        }

        $types = (array) ($node['type'] ?? []);

        if ($value === null && in_array('null', $types, true)) {
            return [null, []];
        }

        return match (array_values(array_diff($types, ['null']))[0] ?? null) {
            'object' => self::object($node, $value, $path),
            'array' => self::list($node, $value, $path),
            'string' => self::string($node, $value, $path),
            'number', 'integer' => self::number($node, $value, $path),
            'boolean' => is_bool($value) ? [$value, []] : self::fail($value, $path, IssueCode::Type, 'Expected boolean'),
            'null' => self::fail($value, $path, IssueCode::Type, 'Expected null'),
            default => [$value, []],
        };
    }

    /**
     * zod's `nullish()` exports as `anyOf: [X, {type: null}]`; anything else is a union:
     * the first branch that passes wins, and a lone branch that failed only its checks reports for the union.
     *
     * @param  list<array<string, mixed>>  $branches
     * @param  list<string|int>  $path
     * @return array{0: mixed, 1: list<array{0: Issue, 1: ?bool}>}
     */
    private static function anyOf(array $branches, mixed $value, array $path): array
    {
        $nullable = array_values(array_filter($branches, fn (array $branch): bool => $branch !== ['type' => 'null']));

        if (count($branches) === 2 && count($nullable) === 1) {
            return $value === null ? [null, []] : self::walk($nullable[0], $value, $path);
        }

        $live = [];

        foreach ($branches as $branch) {
            $result = self::walk($branch, $value, $path);

            if ($result[1] === []) {
                return $result;
            }

            if (! self::aborted($result[1])) {
                $live[] = $result;
            }
        }

        return count($live) === 1 ? $live[0] : self::fail($value, $path, IssueCode::Enum, 'Matches none of the allowed forms');
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  list<string|int>  $path
     * @return array{0: mixed, 1: list<array{0: Issue, 1: ?bool}>}
     */
    private static function object(array $node, mixed $value, array $path): array
    {
        if (! is_array($value) || ($value !== [] && array_is_list($value))) {
            return self::fail($value, $path, IssueCode::Type, 'Expected object');
        }

        $properties = $node['properties'] ?? [];
        $required = $node['required'] ?? [];
        $checked = [];
        $failures = [];

        foreach ($properties as $key => $child) {
            if (! array_key_exists($key, $value)) {
                if (in_array($key, $required, true)) {
                    $failures[] = [new Issue(self::path([...$path, $key]), IssueCode::Required, 'Required'), null];
                }

                continue;
            }

            [$checked[$key], $childFailures] = self::walk($child, $value[$key], [...$path, $key]);
            array_push($failures, ...$childFailures);
        }

        $extra = $node['additionalProperties'] ?? false;

        if (is_array($extra)) {
            foreach ($value as $key => $item) {
                // A JavaScript object cannot keep an own `__proto__` key, so core drops it.
                if (! array_key_exists($key, $properties) && $key !== '__proto__') {
                    [$checked[$key], $childFailures] = self::walk($extra, $item, [...$path, $key]);
                    array_push($failures, ...$childFailures);
                }
            }
        }

        return [$checked, $failures];
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  list<string|int>  $path
     * @return array{0: mixed, 1: list<array{0: Issue, 1: ?bool}>}
     */
    private static function list(array $node, mixed $value, array $path): array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            return self::fail($value, $path, IssueCode::Type, 'Expected array');
        }

        $checked = [];
        $failures = [];

        foreach ($value as $index => $item) {
            [$checked[], $itemFailures] = self::walk($node['items'] ?? [], $item, [...$path, $index]);
            array_push($failures, ...$itemFailures);
        }

        if (in_array(false, array_column($failures, 1), true)) {
            return [$checked, $failures];
        }

        $count = count($value);

        if ($count < ($node['minItems'] ?? 0)) {
            $failures[] = [new Issue(self::path($path), IssueCode::Size, "Too small: at least {$node['minItems']} items"), true];
        }

        if (isset($node['maxItems']) && $count > $node['maxItems']) {
            $failures[] = [new Issue(self::path($path), IssueCode::Size, "Too big: at most {$node['maxItems']} items"), true];
        }

        return [$checked, $failures];
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  list<string|int>  $path
     * @return array{0: mixed, 1: list<array{0: Issue, 1: ?bool}>}
     */
    private static function string(array $node, mixed $value, array $path): array
    {
        if (! is_string($value)) {
            return self::fail($value, $path, IssueCode::Type, 'Expected string');
        }

        $failures = [];
        $where = self::path($path);

        foreach ($node as $keyword => $rule) {
            $failure = match ($keyword) {
                'minLength' => mb_strlen($value, 'UTF-8') < $rule ? new Issue($where, IssueCode::Size, "Too small: at least {$rule} characters") : null,
                'maxLength' => mb_strlen($value, 'UTF-8') > $rule ? new Issue($where, IssueCode::Size, "Too big: at most {$rule} characters") : null,
                'pattern' => preg_match(Js::pattern($rule), $value) !== 1 ? new Issue($where, IssueCode::Pattern, "Must match {$rule}") : null,
                default => null,
            };

            if ($failure !== null) {
                $failures[] = [$failure, true];
            }
        }

        return [$value, $failures];
    }

    /**
     * An integral float is an integer (JSON has one number type); it comes back as a PHP int when it fits.
     *
     * @param  array<string, mixed>  $node
     * @param  list<string|int>  $path
     * @return array{0: mixed, 1: list<array{0: Issue, 1: ?bool}>}
     */
    private static function number(array $node, mixed $value, array $path): array
    {
        if (! (is_int($value) || (is_float($value) && is_finite($value)))) {
            return self::fail($value, $path, IssueCode::Type, 'Expected number');
        }

        $where = self::path($path);
        $failures = [];

        if ($node['type'] === 'integer') {
            if (is_float($value) && floor($value) !== $value) {
                return [$value, [[new Issue($where, IssueCode::Type, 'Expected integer'), false]]];
            }

            if (abs($value) > self::MAX_SAFE_INTEGER) {
                $failures[] = [new Issue($where, IssueCode::Range, 'Outside the safe integer range'), true];
            } else {
                $value = (int) $value;
            }
        }

        if (isset($node['minimum']) && $value < $node['minimum']) {
            $failures[] = [new Issue($where, IssueCode::Range, "Too small: at least {$node['minimum']}"), true];
        }

        if (isset($node['maximum']) && $value > $node['maximum']) {
            $failures[] = [new Issue($where, IssueCode::Range, "Too big: at most {$node['maximum']}"), true];
        }

        return [$value, $failures];
    }

    /** @return array<string, mixed> */
    private static function resolve(string $ref): array
    {
        $name = substr($ref, strlen('#/$defs/'));

        return Assets::schema()['$defs'][$name] ?? throw new \LogicException("Unknown schema reference {$ref}");
    }

    /** JavaScript's SameValueZero for the scalars an enum holds: 400.0 is 400. */
    private static function same(mixed $option, mixed $value): bool
    {
        $isNumber = fn (mixed $candidate): bool => is_int($candidate) || is_float($candidate);

        return $isNumber($option) && $isNumber($value) ? $option == $value : $option === $value;
    }

    /** @param list<array{0: Issue, 1: ?bool}> $failures */
    private static function aborted(array $failures): bool
    {
        return array_filter(array_column($failures, 1), fn (?bool $continue): bool => $continue !== true) !== [];
    }

    /**
     * @param  list<string|int>  $path
     * @return array{0: mixed, 1: list<array{0: Issue, 1: ?bool}>}
     */
    private static function fail(mixed $value, array $path, IssueCode $code, string $message): array
    {
        return [$value, [[new Issue(self::path($path), $code, $message), null]]];
    }

    /** @param list<string|int> $path */
    private static function path(array $path): string
    {
        return implode('.', $path);
    }
}
