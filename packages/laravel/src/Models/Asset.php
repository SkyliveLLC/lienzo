<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * An uploaded image. Documents point at it as `media:<id>`, so its URL can
 * change without touching any page.
 *
 * @property int $id
 * @property int $site_id
 * @property string $name
 * @property string $path
 * @property ?string $thumb_path
 * @property string $mime
 * @property int $size
 * @property ?int $width
 * @property ?int $height
 * @property ?Carbon $created_at
 */
class Asset extends Model
{
    use UsesLienzoConnection;

    public const UPDATED_AT = null;

    protected $table = 'lienzo_assets';

    protected $fillable = ['name', 'path', 'thumb_path', 'mime', 'size', 'width', 'height'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['size' => 'integer', 'width' => 'integer', 'height' => 'integer'];
    }

    /** @return BelongsTo<Site, $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /** What documents store. */
    public function ref(): string
    {
        return "media:{$this->id}";
    }

    /**
     * The site's assets that `$data` mentions as `media:<id>`, keyed by id, in one query.
     *
     * @return Collection<int, static>
     */
    public static function referencedBy(Site $site, mixed $data): Collection
    {
        preg_match_all('/media:([0-9]+)/', json_encode($data, JSON_THROW_ON_ERROR), $matches);

        return $matches[1] === []
            ? new Collection
            : static::query()->whereBelongsTo($site)->whereKey(array_unique($matches[1]))->get()->keyBy('id');
    }
}
