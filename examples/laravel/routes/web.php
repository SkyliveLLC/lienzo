<?php

use App\Http\Controllers\LoginController;
use Illuminate\Support\Facades\Route;
use Skylive\Lienzo\Models\Site;

Route::middleware('guest')->group(function () {
    Route::get('login', [LoginController::class, 'create'])->name('login');
    Route::post('login', [LoginController::class, 'store']);
});

Route::middleware('auth')->group(function () {
    Route::post('logout', [LoginController::class, 'destroy'])->name('logout');
    Route::get('admin', fn () => view('admin', ['site' => Site::default()]))->name('admin');
    Route::lienzoEditor('admin/site');
});

// Lienzo's public pages, sitemap.xml and robots.txt. Last, so the routes above win.
Route::lienzo();
