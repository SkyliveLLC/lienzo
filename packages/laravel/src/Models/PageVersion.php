<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * A document as it was published once. Restoring copies it back into the draft.
 *
 * @property int $id
 * @property int $page_id
 * @property array<string, mixed> $document
 * @property ?Carbon $created_at
 */
class PageVersion extends Model
{
    use UsesLienzoConnection;

    public const UPDATED_AT = null;

    protected $table = 'lienzo_page_versions';

    protected $fillable = ['document'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['document' => 'array'];
    }

    /** @return BelongsTo<Page, $this> */
    public function page(): BelongsTo
    {
        return $this->belongsTo(Page::class);
    }

    /** @return MorphTo<Model, $this> */
    public function createdBy(): MorphTo
    {
        return $this->morphTo();
    }
}
