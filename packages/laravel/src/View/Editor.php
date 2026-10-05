<?php

declare(strict_types=1);

namespace Skylive\Lienzo\View;

use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Vite;
use Illuminate\View\Component;
use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\Http\Routes;
use Skylive\Lienzo\Models\Site;

/**
 * `<x-lienzo::editor :site="$site" locale="en" />`: the editor for one site,
 * as the `<lienzo-editor>` custom element talking to `Route::lienzoEditor()`.
 * The editor echoes Laravel's XSRF-TOKEN cookie, so no CSRF header is passed.
 * Extra attributes (class, style) land on the element.
 */
final class Editor extends Component
{
    public function __construct(public Site $site, public ?string $locale = null) {}

    public function render(): View
    {
        return view('lienzo::editor', [
            'endpoint' => Routes::url('lienzo.editor', ['lienzoSite' => $this->site]),
            'editorLocale' => $this->locale ?? config('lienzo.locale'),
            'script' => Lienzo::editorScriptUrl(),
            'nonce' => Vite::cspNonce(),
        ]);
    }
}
