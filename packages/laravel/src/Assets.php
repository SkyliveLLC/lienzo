<?php

declare(strict_types=1);

namespace Skylive\Lienzo;

/**
 * The static files core builds and this package ships in `dist/` (copied by
 * `pnpm sync:php`): the stylesheet, the page runtime, the JSON Schema and the
 * shared data tables. Each is read once per process.
 */
final class Assets
{
    /** @var array<string, mixed> */
    private static array $cache = [];

    public static function path(string $file): string
    {
        return dirname(__DIR__).'/dist/'.$file;
    }

    public static function stylesheet(): string
    {
        return self::$cache['lienzo.css'] ??= self::read('lienzo.css');
    }

    public static function runtime(): string
    {
        return self::$cache['runtime.js'] ??= self::read('runtime.js');
    }

    /** @return array<string, mixed> */
    public static function schema(): array
    {
        return self::$cache['schema.json'] ??= self::json('schema.json');
    }

    /**
     * Style table, icons, core actions, messages and defaults.
     *
     * @return array{
     *     elementTypes: list<string>,
     *     fieldTypes: list<string>,
     *     themeTokens: list<string>,
     *     defaultTheme: array<string, string|int>,
     *     opaquePropsMaxBytes: int,
     *     styleTable: array<string, array<string, mixed>>,
     *     actions: array<string, array<string, mixed>>,
     *     messages: array<string, array<string, string>>,
     *     icons: array<string, list<array{0: string, 1: array<string, string>}>>,
     * }
     */
    public static function data(): array
    {
        return self::$cache['data.json'] ??= self::json('data.json');
    }

    private static function read(string $file): string
    {
        $contents = file_get_contents(self::path($file));

        if ($contents === false) {
            throw new \RuntimeException("Lienzo asset dist/{$file} is missing. Run `pnpm build && pnpm sync:php`.");
        }

        return $contents;
    }

    /** @return array<string, mixed> */
    private static function json(string $file): array
    {
        return json_decode(self::read($file), true, flags: JSON_THROW_ON_ERROR);
    }
}
