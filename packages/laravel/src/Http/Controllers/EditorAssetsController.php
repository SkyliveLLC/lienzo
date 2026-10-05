<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http\Controllers;

use Skylive\Lienzo\Assets;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Serves the editor bundle shipped in `dist/editor` (its CSS is inlined). URLs carry a content hash, so it caches for good. */
final class EditorAssetsController
{
    public function __invoke(): BinaryFileResponse
    {
        $path = Assets::path('editor/lienzo-editor.js');

        abort_unless(is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => 'text/javascript; charset=UTF-8',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
