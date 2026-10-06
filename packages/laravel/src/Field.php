<?php

declare(strict_types=1);

namespace Skylive\Lienzo;

use LogicException;

/**
 * One setting of an app element, action or site, from core's closed set of
 * field kinds. The editor draws one control per field, and the props schema
 * is derived from the fields, so a field is all an app declares.
 *
 *     Field::number('limit', ['en' => 'How many', 'es' => 'Cuántos'], min: 1, max: 12)->default(6)
 *
 * A label is a string (English) or a map of locale => text that has `en`.
 *
 * @phpstan-type Localized array{en: string}&array<string, string>
 * @phpstan-type FieldSpec array{kind: 'text'|'number'|'toggle'|'choice'|'image'|'action', key: string, label: Localized}&array<string, mixed>
 */
final class Field
{
    /**
     * @param  'text'|'number'|'toggle'|'choice'|'image'|'action'  $kind
     * @param  Localized  $label
     * @param  array<string, mixed>  $spec  the kind's own keys, in core's order
     */
    private function __construct(
        public readonly string $kind,
        public readonly string $key,
        private readonly array $label,
        private array $spec = [],
    ) {
        if (preg_match('/^[A-Za-z][A-Za-z0-9_]{0,39}$/D', $key) !== 1) {
            throw new LogicException("Field key [{$key}] must be a letter followed by up to 39 letters, digits or underscores.");
        }
    }

    /** @param string|Localized $label */
    public static function text(string $key, string|array $label, int $max = 120): self
    {
        return new self('text', $key, self::localized($label), ['max' => $max]);
    }

    /** @param string|Localized $label */
    public static function number(string $key, string|array $label, int|float $min, int|float $max): self
    {
        if ($min > $max) {
            throw new LogicException("Field [{$key}] has a minimum above its maximum.");
        }

        return new self('number', $key, self::localized($label), ['min' => $min, 'max' => $max, 'default' => $min]);
    }

    /** @param string|Localized $label */
    public static function toggle(string $key, string|array $label): self
    {
        return new self('toggle', $key, self::localized($label), ['default' => false]);
    }

    /**
     * @param  string|Localized  $label
     * @param  list<string>|array<string, string|Localized>  $options  values, or value => label
     */
    public static function choice(string $key, string|array $label, array $options): self
    {
        $options = array_map(
            fn (string|int $value, string|array $text): array => ['value' => (string) $value, 'label' => self::localized($text)],
            array_is_list($options) ? $options : array_keys($options),
            $options,
        );

        if ($options === []) {
            throw new LogicException("Field [{$key}] needs at least one option.");
        }

        return new self('choice', $key, self::localized($label), ['options' => $options, 'default' => $options[0]['value']]);
    }

    /** An uploaded image or an https URL. An element's `render` receives the resolved URL. @param string|Localized $label */
    public static function image(string $key, string|array $label): self
    {
        return new self('image', $key, self::localized($label));
    }

    /** A link target (`['type' => 'url', 'value' => 'https://…']`), any core or app action. @param string|Localized $label */
    public static function action(string $key, string|array $label): self
    {
        return new self('action', $key, self::localized($label));
    }

    /** A choice field that keeps every value picked, not just one. */
    public function multiple(bool $multiple = true): self
    {
        $this->expect('choice', 'multiple');
        $this->spec['multiple'] = $multiple;
        $this->spec['default'] = $multiple ? [] : $this->spec['options'][0]['value'];

        return $this;
    }

    /** A text field edited in a textarea. */
    public function multiline(bool $multiline = true): self
    {
        $this->expect('text', 'multiline');
        $this->spec['multiline'] = $multiline;

        return $this;
    }

    public function step(int|float $step): self
    {
        $this->expect('number', 'step');
        $this->spec['step'] = $step;

        return $this;
    }

    public function default(string|int|float|bool|array $value): self
    {
        if ($this->kind === 'choice' && ($this->spec['multiple'] ?? false) === true) {
            $options = array_column($this->spec['options'], 'value');
            $values = is_array($value) ? array_values($value) : [$value];

            if (array_diff($values, $options) !== []) {
                throw new LogicException("Field [{$this->key}] cannot default to ".var_export($value, true).'.');
            }

            $this->spec['default'] = $values;

            return $this;
        }

        $valid = match ($this->kind) {
            'text' => is_string($value) && mb_strlen($value) <= $this->spec['max'],
            'number' => (is_int($value) || is_float($value)) && $value >= $this->spec['min'] && $value <= $this->spec['max'],
            'toggle' => is_bool($value),
            'choice' => in_array($value, array_column($this->spec['options'], 'value'), true),
            'image', 'action' => false,
        };

        if (! $valid) {
            throw new LogicException("Field [{$this->key}] cannot default to ".var_export($value, true).'.');
        }

        $this->spec['default'] = $value;

        return $this;
    }

    /** What an element's `render` receives when the field is not set. @return string|int|float|bool|list<string>|null */
    public function defaultValue(): string|int|float|bool|array|null
    {
        return $this->spec['default'] ?? null;
    }

    /** @return FieldSpec core's `Field` shape, as the catalog carries it */
    public function toArray(): array
    {
        return ['kind' => $this->kind, 'key' => $this->key, 'label' => $this->label, ...$this->spec];
    }

    /**
     * @param  string|array<string, string>  $label
     * @return Localized
     */
    public static function localized(string|array $label): array
    {
        $label = is_string($label) ? ['en' => $label] : $label;

        if (! is_string($label['en'] ?? null)) {
            throw new LogicException('A label needs English text: a string, or an array with an `en` key.');
        }

        return $label;
    }

    private function expect(string $kind, string $method): void
    {
        if ($this->kind !== $kind) {
            throw new LogicException("Field [{$this->key}] is a {$this->kind} field; {$method}() is for {$kind} fields.");
        }
    }
}
