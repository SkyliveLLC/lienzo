<?php

declare(strict_types=1);

namespace Skylive\Lienzo;

use Illuminate\Routing\Route;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use Skylive\Lienzo\Console\InstallCommand;
use Skylive\Lienzo\Http\Routes;
use Skylive\Lienzo\Models\Site;

final class LienzoServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/lienzo.php', 'lienzo');
        $this->app->singleton(LienzoManager::class);
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'lienzo');
        Blade::componentNamespace('Skylive\\Lienzo\\View', 'lienzo');

        Router::macro('lienzo', function (string $prefix = ''): Route {
            /** @var Router $this */
            return Routes::public($this, $prefix);
        });
        Router::macro('lienzoEditor', function (string $prefix): void {
            /** @var Router $this */
            Routes::editor($this, $prefix);
        });
        $this->app->make(Router::class)->model('lienzoSite', Site::class);

        if ($this->app->runningInConsole()) {
            $this->publishes([__DIR__.'/../config/lienzo.php' => config_path('lienzo.php')], 'lienzo-config');
            $this->publishesMigrations([__DIR__.'/../database/migrations' => database_path('migrations')], 'lienzo-migrations');
            $this->commands([InstallCommand::class]);
        }
    }
}
