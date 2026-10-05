<?php

declare(strict_types=1);

namespace Skylive\Lienzo\View;

use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Vite;
use Illuminate\View\Component;
use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Models\Site;

/**
 * `<x-lienzo::editor :site="$site" locale="en" />`: the editor for one site,
 * as the `<lienzo-editor>` custom element talking to `Route::lienzoEditor()`.
 * Extra attributes (class, style) land on the element.
 */
final class Editor extends Component
{
    public function __construct(public Site $site, public ?string $locale = null) {}

    public function render(): View
    {
        return view('lienzo::editor', [
            'endpoint' => route('lienzo.editor', ['lienzoSite' => $this->site]),
            'editorLocale' => $this->locale ?? config('lienzo.locale'),
            'headers' => json_encode(['X-CSRF-TOKEN' => csrf_token(), 'Accept' => 'application/json'], JSON_THROW_ON_ERROR),
            'script' => $this->bundle('js'),
            'style' => $this->bundle('css'),
            'nonce' => Vite::cspNonce(),
        ]);
    }

    /** The bundle file's URL: `lienzo.editor_url` when set, else the editor route with a content hash to bust caches. */
    private function bundle(string $extension): string
    {
        $base = config('lienzo.editor_url');

        if (is_string($base) && $base !== '') {
            return rtrim($base, '/')."/lienzo-editor.{$extension}";
        }

        $path = Assets::path("editor/lienzo-editor.{$extension}");

        return route('lienzo.editor.bundle', ['extension' => $extension, 'v' => is_file($path) ? hash_file('xxh3', $path) : null]);
    }
}
