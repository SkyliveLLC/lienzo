<?php

namespace App\Providers;

use App\Lienzo\LatestPosts;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\Field;
use Skylive\Lienzo\Models\Site;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Who may open the editor and change the site.
        Gate::define('lienzo.manage', fn (User $user, Site $site): bool => $user->is_admin);

        // An element that shows live data from the app.
        Lienzo::element(LatestPosts::class);

        // A site-wide phone number, edited in the editor's site settings, and
        // an action that calls it. Unlike core's Call action, buttons store no
        // number, so changing it in the settings updates every button.
        Lienzo::siteFields(Field::text('phone', ['en' => 'Phone number', 'es' => 'Teléfono'], max: 30));
        Lienzo::action(
            'call_us',
            ['en' => 'Call us', 'es' => 'Llamarnos'],
            fn (?string $value, Site $site): ?string => filled($site->meta['phone'] ?? null)
                ? 'tel:'.preg_replace('/[^\d+]/', '', $site->meta['phone'])
                : null,
        );
    }
}
