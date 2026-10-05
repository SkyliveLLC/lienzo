<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Support\Js;

/**
 * Structure shared by rendering and form handling, twin of core's `canvas.ts`.
 * A canvas is a section or a modal; elements are parsed element arrays.
 *
 * @phpstan-type Group array{kind: 'single', section: array<string, mixed>}|array{kind: 'stack', id: string, type: string, sections: non-empty-list<array<string, mixed>>}
 * @phpstan-type FormField array{kind: 'input', name: string, label: string, required: bool, inputType: string}|array{kind: 'textarea'|'checkbox', name: string, label: string, required: bool}|array{kind: 'select', name: string, label: string, required: bool, options: list<string>}
 * @phpstan-type FormSpec array{source: string, fields: list<FormField>}
 */
final class Canvas
{
    /**
     * Consecutive sections sharing a group id show one at a time, as tabs or
     * steps. A lone section with a group id is just a section.
     *
     * @param  list<array<string, mixed>>  $sections
     * @return list<Group>
     */
    public static function groupSections(array $sections): array
    {
        $runs = [];

        foreach ($sections as $section) {
            $id = $section['group']['id'] ?? null;
            $id = $id === '' ? null : $id;
            $last = array_key_last($runs);

            if ($id !== null && $last !== null && $runs[$last]['id'] === $id) {
                $runs[$last]['sections'][] = $section;
            } else {
                $runs[] = ['id' => $id, 'sections' => [$section]];
            }
        }

        return array_map(fn (array $run): array => $run['id'] !== null && count($run['sections']) > 1
            ? ['kind' => 'stack', 'id' => $run['id'], 'type' => $run['sections'][0]['group']['type'] ?? 'tabs', 'sections' => $run['sections']]
            : ['kind' => 'single', 'section' => $run['sections'][0]], $runs);
    }

    /** One rule for ids in HTML, CSS selectors and field names. */
    public static function safeId(string $id): string
    {
        $safe = (string) preg_replace('/[^A-Za-z0-9_-]/', '', $id);

        return $safe === '' ? 'x' : $safe;
    }

    /** @param array<string, mixed> $element */
    public static function isCore(array $element): bool
    {
        return in_array($element['type'], Assets::data()['elementTypes'], true);
    }

    /** @param array<string, mixed> $element */
    public static function isField(array $element): bool
    {
        return in_array($element['type'], Assets::data()['fieldTypes'], true);
    }

    /**
     * A canvas with fields or a submit button is published inside a form.
     *
     * @param  array<string, mixed>  $canvas
     */
    public static function isForm(array $canvas): bool
    {
        foreach ($canvas['elements'] as $element) {
            if (self::isField($element) || (self::isCore($element) && ($element['props']['action']['type'] ?? null) === 'submit')) {
                return true;
            }
        }

        return false;
    }

    /**
     * A steps group is one form across all its steps, so nothing typed in an earlier step is lost.
     *
     * @param  Group  $group
     */
    public static function isStepsForm(array $group): bool
    {
        return $group['kind'] === 'stack' && $group['type'] === 'steps' && array_filter($group['sections'], self::isForm(...)) !== [];
    }

    /**
     * On mobile a canvas keeps its own layout only if every element has a mobile box; otherwise it stacks.
     *
     * @param  array<string, mixed>  $canvas
     */
    public static function stacks(array $canvas): bool
    {
        return array_filter($canvas['elements'], fn (array $element): bool => ($element['layout']['mobile'] ?? null) === null) !== [];
    }

    /**
     * Stacked order follows the desktop design: higher first, then further left. 1-based, by element index.
     *
     * @param  list<array<string, mixed>>  $elements
     * @return array<int, int>
     */
    public static function stackOrder(array $elements): array
    {
        $indexes = array_keys($elements);
        usort($indexes, fn (int $a, int $b): int => ($elements[$a]['layout']['desktop']['y'] <=> $elements[$b]['layout']['desktop']['y'])
            ?: ($elements[$a]['layout']['desktop']['x'] <=> $elements[$b]['layout']['desktop']['x']));

        return $indexes === [] ? [] : array_combine($indexes, range(1, count($indexes)));
    }

    /**
     * The forms a published document renders, with the fields each accepts.
     * A submission handler validates against this list from the published
     * page, never against whatever the browser posts. Values arrive as `fields[<name>]`.
     *
     * @return list<FormSpec>
     */
    public static function formFields(ParsedDocument $document): array
    {
        $data = $document->toArray();
        $spec = fn (string $source, array $canvases): array => [
            'source' => $source,
            'fields' => array_merge(...array_map(
                fn (array $canvas): array => array_map(self::field(...), array_values(array_filter($canvas['elements'], self::isField(...)))),
                $canvases,
            )),
        ];
        $forms = [];

        foreach (self::groupSections($data['sections']) as $group) {
            if ($group['kind'] === 'single') {
                if (self::isForm($group['section'])) {
                    $forms[] = $spec($group['section']['id'], [$group['section']]);
                }
            } elseif (self::isStepsForm($group)) {
                $forms[] = $spec($group['id'], $group['sections']);
            } else {
                foreach (array_filter($group['sections'], self::isForm(...)) as $section) {
                    $forms[] = $spec($section['id'], [$section]);
                }
            }
        }

        foreach (array_filter($data['modals'] ?? [], self::isForm(...)) as $modal) {
            $forms[] = $spec($modal['id'], [$modal]);
        }

        return $forms;
    }

    /**
     * @param  array<string, mixed>  $element
     * @return FormField
     */
    private static function field(array $element): array
    {
        $props = $element['props'];
        $base = ['name' => self::safeId($element['id']), 'label' => Js::trim($props['label'] ?? ''), 'required' => ($props['required'] ?? null) === true];

        return match ($element['type']) {
            'select' => ['kind' => 'select', ...$base, 'options' => $props['options'] ?? []],
            'textarea', 'checkbox' => ['kind' => $element['type'], ...$base],
            default => ['kind' => 'input', ...$base, 'inputType' => $props['input_type'] ?? 'text'],
        };
    }
}
