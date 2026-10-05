<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

/** Everything the renderer cannot know by itself, one method per hole (core's `RenderHost`). */
interface RenderHost
{
    /** Resolves `media:<id>`. Null for a deleted or unknown asset. */
    public function media(string $ref): ?MediaFile;

    /**
     * Href for an app-registered action type. Core actions never reach this.
     *
     * @param  array{type: string, value?: ?string}  $action
     */
    public function action(array $action): ?string;

    /**
     * Live data lives here: called on every public render, with props checked against the type's fields.
     *
     * @param  array<string, mixed>  $element
     */
    public function appElement(array $element): TrustedHtml;

    /** Null renders forms inert (the editor canvas). */
    public function form(): ?FormHost;

    /** Developer-produced head markup (analytics, structured data). */
    public function head(): ?TrustedHtml;

    /** CSP nonce for the inline style and script. */
    public function nonce(): ?string;
}
