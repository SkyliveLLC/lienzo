<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Document;

use Skylive\Lienzo\Assets;

/**
 * Site settings that passed `parse`, with defaults filled: locale `en`, and
 * any theme key not set falls back to core's default theme. Fonts must match
 * `^[A-Za-z0-9 ]{1,60}$` because they reach `font-family` and a URL.
 *
 * @phpstan-type Theme array{primary: string, secondary: string, background: string, surface: string, text: string, muted: string, heading_font: string, body_font: string, radius: int, max_width: int}
 * @phpstan-type Seo array{title?: ?string, description?: ?string}
 */
final readonly class ParsedSiteSettings
{
    /**
     * @param  Theme  $theme
     * @param  Seo  $seo
     */
    private function __construct(
        public string $name,
        public string $locale,
        public array $theme,
        public array $seo,
        public ?string $favicon,
        public ?string $ogImage,
    ) {}

    /** @throws DocumentError */
    public static function parse(mixed $input): self
    {
        $site = Schema::check(Schema::ref('SiteSettings'), $input);

        return new self(
            name: $site['name'],
            locale: $site['locale'] ?? 'en',
            theme: self::theme($site['theme'] ?? null),
            seo: $site['seo'] ?? [],
            favicon: $site['favicon'] ?? null,
            ogImage: $site['og_image'] ?? null,
        );
    }

    /** @return array{name: string, locale: string, theme: Theme, seo: Seo, favicon: ?string, og_image: ?string} */
    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'locale' => $this->locale,
            'theme' => $this->theme,
            'seo' => $this->seo,
            'favicon' => $this->favicon,
            'og_image' => $this->ogImage,
        ];
    }

    /** @return Theme */
    private static function theme(mixed $input): array
    {
        $theme = Schema::check(Schema::ref('Theme'), $input ?? []);
        $filled = [];

        foreach (Assets::data()['defaultTheme'] as $key => $fallback) {
            $filled[$key] = $theme[$key] ?? $fallback;
        }

        return $filled;
    }
}
