<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests;

/** Paths and readers for the shared fixtures at the repository root. */
final class Fixtures
{
    public static function path(string $relative): string
    {
        return dirname(__DIR__, 3).'/fixtures/'.$relative;
    }

    /** @return array<string, mixed> */
    public static function json(string $relative): array
    {
        return json_decode((string) file_get_contents(self::path($relative)), true, flags: JSON_THROW_ON_ERROR);
    }

    /** @return array<string, mixed> */
    public static function catalog(): array
    {
        return self::json('render/catalog.json');
    }

    /** @return list<string> render fixture names, like core's `fixtureNames()` */
    public static function renderNames(): array
    {
        $names = array_map(fn (string $file): string => basename($file, '.json'), glob(self::path('render/*.json')) ?: []);

        return array_values(array_filter($names, fn (string $name): bool => $name !== 'catalog'));
    }

    /** Pretty JSON for comparing parse results, so a failure shows a readable diff. */
    public static function encode(mixed $value): string
    {
        return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
