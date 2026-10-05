<?php

declare(strict_types=1);

use Skylive\Lienzo\Assets;

/** Each shipped file and the build output it must equal. */
dataset('shipped assets', fn (): array => [
    'data.json' => ['data.json', 'core/dist/data.json'],
    'lienzo.css' => ['lienzo.css', 'core/dist/lienzo.css'],
    'runtime.js' => ['runtime.js', 'core/dist/runtime.js'],
    'schema.json' => ['schema.json', 'core/dist/schema.json'],
    'editor' => ['editor/lienzo-editor.js', 'editor/dist/standalone/lienzo-editor.js'],
]);

it('ships the assets of a fresh build (run `pnpm build && pnpm sync:php`)', function (string $shipped, string $built): void {
    $path = dirname(__DIR__, 2).'/'.$built;

    expect(is_file($path))->toBeTrue("packages/{$built} is missing: run `pnpm build` first")
        ->and(file_get_contents(Assets::path($shipped)))->toBe(file_get_contents($path));
})->with('shipped assets');

it('ships nothing else', function (): void {
    $root = dirname(Assets::path('x'));
    $files = array_map(fn (string $path): string => substr($path, strlen($root) + 1), [...glob($root.'/*.*') ?: [], ...glob($root.'/editor/*') ?: []]);

    expect($files)->toEqualCanonicalizing(['data.json', 'lienzo.css', 'runtime.js', 'schema.json', 'editor/lienzo-editor.js']);
});
