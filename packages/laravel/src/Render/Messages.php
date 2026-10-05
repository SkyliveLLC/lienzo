<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use Skylive\Lienzo\Assets;

/** Strings the public page shows, from core's `data.json`. `{n}` is replaced with a 1-based position. */
final class Messages
{
    /**
     * `es-MX` falls back to `es`, then to English.
     *
     * @return array<string, string>
     */
    public static function for(string $locale): array
    {
        $messages = Assets::data()['messages'];

        return $messages[$locale] ?? $messages[explode('-', $locale)[0]] ?? $messages['en'];
    }
}
