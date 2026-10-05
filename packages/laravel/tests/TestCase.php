<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests;

use Illuminate\Foundation\Auth\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Gate;
use Orchestra\Testbench\TestCase as Testbench;
use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\LienzoServiceProvider;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Tests\App\NewsElement;

use function Orchestra\Testbench\default_migration_path;

/**
 * A small app using Lienzo the documented way: editor routes behind auth,
 * public routes last, a `news` element reading live data, a `booking`
 * action, and editors allowed by email.
 */
abstract class TestCase extends Testbench
{
    use RefreshDatabase;

    public const string EDITOR = 'editor@example.com';

    protected function getPackageProviders($app): array
    {
        return [LienzoServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('k', 32)));
        $app['config']->set('lienzo.disk', 'lienzo-test');
        $app['config']->set('filesystems.disks.lienzo-test', ['driver' => 'local', 'root' => storage_path('framework/testing/disks/lienzo')]);
    }

    protected function defineDatabaseMigrations(): void
    {
        $this->loadMigrationsFrom([default_migration_path(), __DIR__.'/../database/migrations']);
    }

    protected function defineRoutes($router): void
    {
        $router->middleware('web')->group(function (Router $router): void {
            $router->lienzoEditor('admin/site');
            $router->lienzo();
        });
    }

    protected function setUp(): void
    {
        parent::setUp();

        Gate::define('lienzo.manage', fn (User $user, Site $site): bool => $user->email === self::EDITOR);
        Lienzo::element(NewsElement::class);
        Lienzo::action('booking', ['en' => 'Book online'], fn (?string $value, Site $site): string => "/book?site={$site->id}");
    }
}
