<?php

namespace Database\Seeders;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** One admin who may edit the site (admin@example.com / password) and a few posts. */
    public function run(): void
    {
        User::create(['name' => 'Admin', 'email' => 'admin@example.com', 'password' => 'password', 'is_admin' => true]);

        foreach (['Hello, world', 'Shipping the first version', 'What we learned this month'] as $title) {
            Post::create(['title' => $title]);
        }
    }
}
