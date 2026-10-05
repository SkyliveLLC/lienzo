<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;

$published = fn (): array => [config_path('lienzo.php'), ...File::glob(database_path('migrations/*_create_lienzo_tables.php'))];

beforeEach(fn () => File::delete($published()));
afterEach(fn () => File::delete($published()));

it('publishes the config and the migration once, however often it runs', function (): void {
    $this->artisan('lienzo:install')->assertSuccessful()->expectsOutputToContain('php artisan migrate');
    $this->travel(1)->minute();
    $this->artisan('lienzo:install')->assertSuccessful();

    expect(config_path('lienzo.php'))->toBeFile()
        ->and(File::glob(database_path('migrations/*_create_lienzo_tables.php')))->toHaveCount(1);
});
