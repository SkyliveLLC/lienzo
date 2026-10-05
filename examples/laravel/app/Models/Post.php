<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** A blog post: the app's own data, which the `latest_posts` element shows live. */
#[Fillable(['title'])]
class Post extends Model {}
