<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http;

use Illuminate\Routing\Route;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route as RouteFacade;
use Skylive\Lienzo\Http\Controllers\EditorAssetsController;
use Skylive\Lienzo\Http\Controllers\EditorController;
use Skylive\Lienzo\Http\Controllers\PublicController;

/**
 * What `Route::lienzo()` and `Route::lienzoEditor()` register. Route
 * parameters carry a `lienzo` prefix so an app's own `Route::bind('page')`
 * never reaches them. Either may sit in a group with parameters of its own,
 * like `Route::domain('{tenant}')`: controllers read parameters by name, and
 * URLs come from `url()`.
 */
final class Routes
{
    /**
     * Public pages under `$prefix`, plus their sitemap, robots.txt, form
     * endpoint and image route. Returns the catch-all page route, so it can
     * be constrained: `Route::lienzo()->where('slug', '(?!admin$)[a-z0-9-]+')`.
     * Register it last; routes declared before it win.
     */
    public static function public(Router $router, string $prefix = ''): Route
    {
        $prefix = trim($prefix, '/');

        $router->prefix($prefix)->name('lienzo.')->group(function (Router $router): void {
            $router->get('lienzo/media/{lienzoAsset}/{size?}', [PublicController::class, 'media'])
                ->whereNumber('lienzoAsset')->whereIn('size', ['thumb'])->name('media');
            $router->post('lienzo/submit', [PublicController::class, 'submit'])
                ->middleware('throttle:'.config('lienzo.submissions_per_minute').',1')->name('submit');
            $router->get('sitemap.xml', [PublicController::class, 'sitemap'])->name('sitemap');
            $router->get('robots.txt', [PublicController::class, 'robots'])->name('robots');
        });

        return $router->get(ltrim("{$prefix}/{slug?}", '/'), [PublicController::class, 'page'])
            ->where('slug', '[a-z0-9]+(-[a-z0-9]+)*')
            ->name('lienzo.page');
    }

    /**
     * The editor protocol for `{$prefix}/{site}` (the endpoint the editor is
     * given), and the editor bundle. Every site route checks `lienzo.manage`.
     */
    public static function editor(Router $router, string $prefix): void
    {
        $router->prefix(trim($prefix, '/'))->middleware(config('lienzo.editor_middleware'))->group(function (Router $router): void {
            $router->get('lienzo-editor.js', EditorAssetsController::class)->name('lienzo.editor.bundle');

            $router->prefix('{lienzoSite}')->whereNumber('lienzoSite')->middleware('can:lienzo.manage,lienzoSite')->controller(EditorController::class)->group(function (Router $router): void {
                $router->get('/', 'workspace')->name('lienzo.editor');
                $router->put('site', 'updateSite')->name('lienzo.editor.site');
                $router->post('pages', 'storePage')->name('lienzo.editor.pages.store');
                $router->get('pages/{lienzoPage}', 'showPage')->whereNumber('lienzoPage')->name('lienzo.editor.pages.show');
                $router->put('pages/{lienzoPage}', 'updatePage')->whereNumber('lienzoPage')->name('lienzo.editor.pages.update');
                $router->delete('pages/{lienzoPage}', 'destroyPage')->whereNumber('lienzoPage')->name('lienzo.editor.pages.destroy');
                $router->post('pages/{lienzoPage}/publish', 'publish')->whereNumber('lienzoPage')->name('lienzo.editor.pages.publish');
                $router->post('pages/{lienzoPage}/versions/{lienzoVersion}/restore', 'restore')
                    ->whereNumber(['lienzoPage', 'lienzoVersion'])->name('lienzo.editor.pages.restore');
                $router->post('assets', 'storeAsset')->name('lienzo.editor.assets.store');
                $router->delete('assets/{lienzoAsset}', 'destroyAsset')->whereNumber('lienzoAsset')->name('lienzo.editor.assets.destroy');
                $router->get('media/{lienzoAsset}/{size?}', 'media')->whereNumber('lienzoAsset')->whereIn('size', ['thumb'])->name('lienzo.editor.media');
                $router->post('preview', 'preview')->name('lienzo.editor.preview');
                $router->get('submissions', 'submissions')->name('lienzo.editor.submissions');
            });
        });
    }

    /**
     * `route()` for a Lienzo route, with the parameters of its enclosing
     * group (a `{tenant}` domain) taken from the current route when it has
     * them. Given parameters win.
     *
     * @param  array<string, mixed>  $parameters
     */
    public static function url(string $name, array $parameters = []): string
    {
        $current = RouteFacade::current();
        $needs = RouteFacade::getRoutes()->getByName($name)?->parameterNames() ?? [];
        $inherited = $current === null ? [] : array_intersect_key($current->parameters(), array_flip($needs));

        return route($name, [...$inherited, ...$parameters]);
    }
}
