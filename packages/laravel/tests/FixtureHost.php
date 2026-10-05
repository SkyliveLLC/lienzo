<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests;

use Skylive\Lienzo\Render\FormHost;
use Skylive\Lienzo\Render\MediaFile;
use Skylive\Lienzo\Render\RenderHost;
use Skylive\Lienzo\Render\TrustedHtml;

/**
 * The host stubs a render fixture carries as data (see core's scripts/golden.ts):
 * a media map, app action hrefs and form state. App elements render as
 * `<div class="fixture-app">TYPE</div>`.
 */
final readonly class FixtureHost implements RenderHost
{
    /** @param array{media: array<string, array{url: string, thumb: ?string, width: ?int, height: ?int}>, actions: array<string, string>, form: ?array{action: string, csrf: ?array{name: string, value: string}, old: array<string, string>, errors: array<string, string>, notice: ?string}, nonce: ?string, head: ?string} $stubs */
    public function __construct(private array $stubs) {}

    public function media(string $ref): ?MediaFile
    {
        $file = $this->stubs['media'][$ref] ?? null;

        return $file === null ? null : new MediaFile($file['url'], $file['thumb'], $file['width'], $file['height']);
    }

    public function action(array $action): ?string
    {
        return $this->stubs['actions'][$action['type']] ?? null;
    }

    public function appElement(array $element): TrustedHtml
    {
        return new TrustedHtml("<div class=\"fixture-app\">{$element['type']}</div>");
    }

    public function form(): ?FormHost
    {
        return $this->stubs['form'] === null ? null : new FixtureForm($this->stubs['form']);
    }

    public function head(): ?TrustedHtml
    {
        return ($this->stubs['head'] ?? '') === '' ? null : new TrustedHtml($this->stubs['head']);
    }

    public function nonce(): ?string
    {
        return $this->stubs['nonce'];
    }
}
