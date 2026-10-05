<?php

declare(strict_types=1);

use Skylive\Lienzo\Assets;

dataset('shipped assets', fn (): array => array_map('basename', glob(dirname(Assets::path('x')).'/*') ?: []));

it('ships the assets of a fresh core build (run `pnpm build && pnpm sync:php`)', function (string $file): void {
    $built = dirname(__DIR__, 2).'/core/dist/'.$file;

    expect(is_file($built))->toBeTrue("packages/core/dist/{$file} is missing: run `pnpm build` first")
        ->and(file_get_contents(Assets::path($file)))->toBe(file_get_contents($built));
})->with('shipped assets');

it('ships every asset the renderer reads', function (): void {
    expect(array_map('basename', glob(dirname(Assets::path('x')).'/*') ?: []))
        ->toEqualCanonicalizing(['data.json', 'lienzo.css', 'runtime.js', 'schema.json']);
});
