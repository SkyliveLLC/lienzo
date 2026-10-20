<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests\App;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** A package that loads its routes while it boots, before Lienzo boots, the way Filament loads panel routes. */
final class PanelProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::middleware('web')->prefix('panel')->group(function (): void {
            Route::lienzoEditor('site');
        });
    }
}
