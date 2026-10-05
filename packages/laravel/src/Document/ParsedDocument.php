<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Document;

use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Support\Js;

/**
 * A document that passed `parse`, the only way to make one, so render code
 * never sees unchecked input. Same rules as core's `parseDocument`: unknown
 * keys are stripped, out-of-range values rejected, legacy modals upgraded,
 * and elements whose type is neither core nor in the catalog kept as opaque.
 *
 * Input is JSON decoded with associative arrays (what Laravel's casts give).
 *
 * @phpstan-type Box array{x: int|float, y: int|float, w: int|float, h: int|float}
 * @phpstan-type Element array{id: string, type: string, z: int, locked?: ?bool, group?: ?string, layout: array{desktop: Box, mobile?: ?Box}, props: array<string, mixed>, style: array<string, mixed>}
 * @phpstan-type Canvas array{id: string, elements: list<Element>}&array<string, mixed>
 * @phpstan-type Catalog array{elements: list<array{type: string, fields: list<array<string, mixed>>, css?: string}&array<string, mixed>>, actions: list<array{type: string}&array<string, mixed>>}
 */
final readonly class ParsedDocument
{
    /** @param array{sections: list<Canvas>, modals?: ?list<Canvas>} $document */
    private function __construct(private array $document) {}

    /**
     * @param  Catalog  $catalog
     *
     * @throws DocumentError
     */
    public static function parse(mixed $input, array $catalog): self
    {
        $envelope = Schema::check(Assets::schema(), self::upgradeLegacyModals($input));
        $appFields = array_column($catalog['elements'], 'fields', 'type');
        $issues = [];

        $canvas = function (array $canvas, array $path) use ($appFields, &$issues): array {
            foreach ($canvas['elements'] as $index => $element) {
                $canvas['elements'][$index] = self::parseProps($element, $appFields, [...$path, 'elements', $index], $issues);
            }

            return $canvas;
        };

        $document = ['sections' => array_map(
            fn (array $section, int $index): array => $canvas($section, ['sections', $index]),
            $envelope['sections'],
            array_keys($envelope['sections']),
        )];

        if (array_key_exists('modals', $envelope)) {
            $document['modals'] = $envelope['modals'] === null ? null : array_map(
                fn (array $modal, int $index): array => $canvas($modal, ['modals', $index]),
                $envelope['modals'],
                array_keys($envelope['modals']),
            );
        }

        if ($issues !== []) {
            throw new DocumentError($issues);
        }

        return new self($document);
    }

    /** @return array{sections: list<Canvas>, modals?: ?list<Canvas>} */
    public function toArray(): array
    {
        return $this->document;
    }

    /**
     * Props are checked after the envelope, by type: core props, an app
     * element's fields, or only a size limit for a type nobody registered.
     *
     * @param  array<string, mixed>  $element
     * @param  array<string, list<array<string, mixed>>>  $appFields
     * @param  list<string|int>  $path
     * @param  list<Issue>  $issues
     * @return array<string, mixed>
     */
    private static function parseProps(array $element, array $appFields, array $path, array &$issues): array
    {
        $propsPath = [...$path, 'props'];
        $type = $element['type'];

        $schema = match (true) {
            in_array($type, Assets::data()['elementTypes'], true) => Schema::ref('CoreProps'),
            isset($appFields[$type]) => self::fieldsSchema($appFields[$type]),
            default => null,
        };

        if ($schema === null) {
            $json = json_encode($element['props'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_LINE_TERMINATORS);
            $max = Assets::data()['opaquePropsMaxBytes'];

            if (strlen((string) $json) > $max) {
                $issues[] = new Issue(implode('.', $propsPath), IssueCode::Size, "Too big: at most {$max} bytes");
            }

            return $element;
        }

        try {
            $element['props'] = Schema::check($schema, $element['props'], $propsPath);
        } catch (DocumentError $error) {
            array_push($issues, ...$error->issues);
        }

        return $element;
    }

    /**
     * Schema for an app element's props, derived from its declared fields like core's `fieldsSchema`.
     *
     * @param  list<array<string, mixed>>  $fields
     * @return array<string, mixed>
     */
    private static function fieldsSchema(array $fields): array
    {
        $properties = [];

        foreach ($fields as $field) {
            $value = match ($field['kind']) {
                'text' => ['type' => 'string', 'maxLength' => $field['max']],
                'number' => ['type' => 'number', 'minimum' => $field['min'], 'maximum' => $field['max']],
                'toggle' => ['type' => 'boolean'],
                'choice' => ['type' => 'string', 'enum' => array_column($field['options'], 'value')],
                'image' => Schema::ref('Image'),
                'action' => Schema::ref('Action'),
            };
            $properties[$field['key']] = [
                'anyOf' => [$value, ['type' => 'null']],
                'x-blank-as-null' => $field['kind'] !== 'text',
            ];
        }

        return ['type' => 'object', 'properties' => $properties, 'additionalProperties' => false];
    }

    /**
     * Modals started as `{ id, title, text }` and later became canvases. Old
     * ones are upgraded here on read instead of migrating stored JSON.
     */
    private static function upgradeLegacyModals(mixed $input): mixed
    {
        if (! self::isRecord($input) || ! is_array($input['modals'] ?? null) || ! array_is_list($input['modals'])) {
            return $input;
        }

        $input['modals'] = array_map(function (mixed $modal): mixed {
            if (! self::isRecord($modal)) {
                return $modal;
            }

            $modalId = $modal['id'] ?? 'modal';

            return [
                ...$modal,
                'id' => $modalId,
                'title' => $modal['title'] ?? 'Modal',
                'size' => $modal['size'] ?? 'custom',
                'show_title' => $modal['show_title'] ?? true,
                'width' => $modal['width'] ?? 520,
                'height' => $modal['height'] ?? ['desktop' => 320, 'mobile' => 420],
                'background' => $modal['background'] ?? ['type' => 'color', 'color' => 'background'],
                // A modal id that is not a string fails the schema whatever its text element is called.
                'elements' => $modal['elements'] ?? self::legacyText(is_string($modalId) ? $modalId : 'modal', $modal['text'] ?? null),
            ];
        }, $input['modals']);

        return $input;
    }

    /** @return list<array<string, mixed>> */
    private static function legacyText(string $modalId, mixed $value): array
    {
        $text = is_string($value) ? Js::trim($value) : '';

        return $text === '' ? [] : [[
            'id' => "{$modalId}-text",
            'type' => 'text',
            'z' => 1,
            'layout' => ['desktop' => ['x' => 6, 'y' => 56, 'w' => 88, 'h' => 200], 'mobile' => null],
            'props' => ['text' => $text],
            'style' => ['color' => 'text', 'font' => 'body', 'size' => 16, 'line_height' => 1.6],
        ]];
    }

    /** A JSON object, including `[]`, which PHP uses for an empty one. */
    private static function isRecord(mixed $value): bool
    {
        return is_array($value) && ($value === [] || ! array_is_list($value));
    }
}
