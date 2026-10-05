<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;
use Skylive\Lienzo\Document\ParsedSiteSettings;

/**
 * A landing site: settings, pages and uploads, owned by any model (a team,
 * a tenant) or by nobody in a single-site app.
 *
 * @property int $id
 * @property ?string $owner_type
 * @property int|string|null $owner_id
 * @property string $name
 * @property ?string $locale
 * @property ?array<string, mixed> $theme
 * @property ?array{title?: ?string, description?: ?string} $seo
 * @property ?string $favicon
 * @property ?string $og_image
 * @property ?array<string, mixed> $meta
 * @property ?Carbon $created_at
 * @property ?Carbon $updated_at
 */
class Site extends Model
{
    use UsesLienzoConnection;

    protected $table = 'lienzo_sites';

    protected $fillable = ['name', 'locale', 'theme', 'seo', 'favicon', 'og_image', 'meta'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['theme' => 'array', 'seo' => 'array', 'meta' => 'array'];
    }

    /**
     * The owner's site, created on first use.
     *
     * @param  array<string, mixed>  $attributes  used only when creating, e.g. `['name' => $team->name]`
     */
    public static function forOwner(Model $owner, array $attributes = []): static
    {
        return static::firstOrCreateOwnedBy($owner->getMorphClass(), $owner->getKey(), $attributes);
    }

    /**
     * The ownerless site of a single-site app, created on first use. The
     * unique index cannot hold for NULL owners, so two first requests may
     * both create one; every later call agrees on the oldest.
     */
    public static function default(): static
    {
        $oldest = fn (): ?self => static::query()->whereNull('owner_type')->whereNull('owner_id')->oldest('id')->first();

        if ($oldest() === null) {
            static::firstOrCreateOwnedBy(null, null);
        }

        return $oldest();
    }

    /**
     * The owner columns are not fillable, so a request can never move a site; only these two methods set them.
     *
     * @param  array<string, mixed>  $attributes
     */
    private static function firstOrCreateOwnedBy(?string $type, int|string|null $id, array $attributes = []): static
    {
        return static::unguarded(fn (): static => static::query()->firstOrCreate(
            ['owner_type' => $type, 'owner_id' => $id],
            ['name' => config('app.name'), ...$attributes],
        ));
    }

    /** @return MorphTo<Model, $this> */
    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return HasMany<Page, $this> */
    public function pages(): HasMany
    {
        return $this->hasMany(Page::class);
    }

    /** @return HasMany<Asset, $this> */
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    /** @return HasMany<Submission, $this> */
    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class);
    }

    /** Whether visitors may load the asset: a published page, the favicon, the share image or a site field uses it. */
    public function publishes(Asset $asset): bool
    {
        $public = [$this->favicon, $this->og_image, $this->meta, ...$this->pages()->published()->get(['published'])->pluck('published')];

        return str_contains(json_encode($public, JSON_THROW_ON_ERROR), '"'.$asset->ref().'"');
    }

    /** The settings the renderer and the editor read, with theme defaults filled. */
    public function settings(): ParsedSiteSettings
    {
        return ParsedSiteSettings::parse([
            'name' => $this->name,
            'locale' => $this->locale,
            'theme' => $this->theme,
            'seo' => $this->seo,
            'favicon' => $this->favicon,
            'og_image' => $this->og_image,
        ]);
    }
}
