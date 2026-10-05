<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * A page of a site. The editor writes `draft`, `slug` and `seo`; publishing
 * copies them to `published`, `published_slug` and `published_seo`, which is
 * all the public site ever reads. `revision` counts saved drafts, so a stale
 * editor tab gets a conflict instead of overwriting.
 *
 * @property int $id
 * @property int $site_id
 * @property string $slug
 * @property string $title
 * @property ?array{title?: ?string, description?: ?string} $seo
 * @property array<string, mixed> $draft
 * @property int $revision
 * @property ?array<string, mixed> $published
 * @property ?string $published_slug
 * @property ?array{title?: ?string, description?: ?string} $published_seo
 * @property ?CarbonImmutable $published_at
 * @property ?Carbon $created_at
 * @property ?Carbon $updated_at
 * @property-read Site $site
 */
class Page extends Model
{
    use UsesLienzoConnection;

    /** A new page: one empty section. */
    public const array BLANK = [
        'sections' => [[
            'id' => 'start',
            'height' => ['desktop' => 520, 'mobile' => 560],
            'background' => ['type' => 'color', 'color' => 'background'],
            'elements' => [],
        ]],
    ];

    protected $table = 'lienzo_pages';

    protected $fillable = ['slug', 'title', 'seo', 'draft', 'revision', 'published', 'published_slug', 'published_seo', 'published_at'];

    protected $attributes = ['revision' => 1];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'seo' => 'array',
            'draft' => 'array',
            'revision' => 'integer',
            'published' => 'array',
            'published_seo' => 'array',
            'published_at' => 'immutable_datetime',
        ];
    }

    /** @param Builder<self> $query */
    public function scopePublished(Builder $query): void
    {
        $query->whereNotNull('published');
    }

    /** @return BelongsTo<Site, $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /** @return HasMany<PageVersion, $this> */
    public function versions(): HasMany
    {
        return $this->hasMany(PageVersion::class);
    }

    /** @return MorphTo<Model, $this> */
    public function publishedBy(): MorphTo
    {
        return $this->morphTo();
    }
}
