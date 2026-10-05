<?php

declare(strict_types=1);

use Illuminate\Support\Facades\File;

$published = fn (): array => [config_path('lienzo.php'), public_path('robots.txt'), ...File::glob(database_path('migrations/*_create_lienzo_tables.php'))];

beforeEach(fn () => File::delete($published()));
afterEach(fn () => File::delete($published()));

it('publishes the config and the migration once, however often it runs', function (): void {
    $this->artisan('lienzo:install')->assertSuccessful()->expectsOutputToContain('php artisan migrate');
    $this->travel(1)->minute();
    $this->artisan('lienzo:install')->assertSuccessful();

    expect(config_path('lienzo.php'))->toBeFile()
        ->and(File::glob(database_path('migrations/*_create_lienzo_tables.php')))->toHaveCount(1);
});

it("removes Laravel's stock public/robots.txt, which would shadow the robots.txt route", function (): void {
    File::put(public_path('robots.txt'), "User-agent: *\r\nDisallow:\r\n");

    $this->artisan('lienzo:install')->assertSuccessful();

    expect(public_path('robots.txt'))->not->toBeFile();
});

it('keeps a customized public/robots.txt and says it shadows the route', function (): void {
    File::put(public_path('robots.txt'), "User-agent: *\nDisallow: /private\n");

    $this->artisan('lienzo:install')->assertSuccessful()->expectsOutputToContain('public/robots.txt');

    expect(File::get(public_path('robots.txt')))->toBe("User-agent: *\nDisallow: /private\n");
});
