<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Concerns;

use Illuminate\Database\Eloquent\Relations\MorphOne;
use Skylive\Lienzo\Models\Site;

/** For models that own a site (a team, a tenant). `Site::forOwner($model)` creates it on first use. */
trait HasLienzoSite
{
    /** @return MorphOne<Site, $this> */
    public function lienzoSite(): MorphOne
    {
        return $this->morphOne(Site::class, 'owner');
    }
}
