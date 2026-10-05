<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * What a visitor sent through a form on a published page. `page` is the
 * page's slug at the time, so the inbox outlives the page. A checkbox's
 * `value` is a boolean; every other value is the text sent.
 *
 * @property int $id
 * @property int $site_id
 * @property string $page
 * @property string $source
 * @property list<array{name: string, label: string, value: string|bool}> $fields
 * @property ?string $ip
 * @property ?Carbon $created_at
 */
class Submission extends Model
{
    use UsesLienzoConnection;

    public const UPDATED_AT = null;

    protected $table = 'lienzo_submissions';

    protected $fillable = ['page', 'source', 'fields', 'ip'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['fields' => 'array'];
    }

    /** @return BelongsTo<Site, $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
