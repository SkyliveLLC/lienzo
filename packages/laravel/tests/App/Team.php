<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests\App;

use Illuminate\Database\Eloquent\Model;
use Skylive\Lienzo\Concerns\HasLienzoSite;

/** An owner model, stored in the users table to need no migration of its own. */
final class Team extends Model
{
    use HasLienzoSite;

    protected $table = 'users';
}
