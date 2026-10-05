<?php

declare(strict_types=1);

namespace Skylive\Lienzo;

use Illuminate\Contracts\Support\Htmlable;
use Skylive\Lienzo\Models\Site;

/**
 * An element type the app adds to the editor, registered with
 * `Lienzo::element(MyElement::class)`. Its fields drive the settings panel
 * and the props schema; `render` is its only renderer, called on every
 * public request (live data) and for the editor's previews, so the canvas
 * shows exactly what the public page serves.
 *
 * @phpstan-import-type Localized from Field
 * @phpstan-import-type FieldSpec from Field
 */
abstract class Element
{
    /** Stored in documents. Lowercase letters, digits, `_` or `-`, starting with a letter; not a core type. */
    protected string $type;

    /** @var string|Localized */
    protected string|array $label;

    /** An icon from core's catalog, for the insert menu. */
    protected string $icon = 'sparkles';

    /** @var list<'text'|'fill'|'border'|'effects'|'motion'> style groups the editor offers */
    protected array $styles = ['text', 'fill', 'border', 'effects', 'motion'];

    /** @var array{w: int|float, h: int} default box: width in % of the frame, height in px */
    protected array $size = ['w' => 80, 'h' => 240];

    /** @return list<Field> */
    abstract public function fields(): array;

    /**
     * The element's inner markup. Lienzo positions and styles the wrapper.
     * Every field is present: unset ones hold their default (or null), and
     * image fields hold a URL.
     *
     * @param  array<string, mixed>  $props
     */
    abstract public function render(array $props, Site $site): Htmlable;

    /** Trusted CSS, nested under this element type on every page that uses it. */
    public function css(): ?string
    {
        return null;
    }

    public function type(): string
    {
        return $this->type;
    }

    /**
     * Core's `ElementSpec`, as the editor's catalog carries it.
     *
     * @return array{type: string, label: Localized, icon: string, fields: list<FieldSpec>, styles: list<string>, size: array{w: int|float, h: int}, css?: string}
     */
    public function toArray(): array
    {
        $css = $this->css();

        return [
            'type' => $this->type,
            'label' => Field::localized($this->label),
            'icon' => $this->icon,
            'fields' => array_map(fn (Field $field): array => $field->toArray(), $this->fields()),
            'styles' => $this->styles,
            'size' => $this->size,
            ...($css === null ? [] : ['css' => $css]),
        ];
    }
}
