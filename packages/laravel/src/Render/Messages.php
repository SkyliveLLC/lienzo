<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use Skylive\Lienzo\Assets;

/** Strings the public page shows, from core's `data.json`. `{n}` is replaced with a 1-based position. */
final class Messages
{
    /**
     * `es-MX` falls back to `es`, then to English, key by key. `$extra` holds
     * an app's strings by locale and wins over the shipped ones.
     *
     * @param  array<string, array<string, string>>  $extra
     * @return array<string, string>
     */
    public static function for(string $locale, array $extra = []): array
    {
        $shipped = Assets::data()['messages'];
        $language = explode('-', $locale)[0];

        return [
            ...$shipped['en'],
            ...$extra['en'] ?? [],
            ...$shipped[$language] ?? [],
            ...$extra[$language] ?? [],
            ...$shipped[$locale] ?? [],
            ...$extra[$locale] ?? [],
        ];
    }
}
