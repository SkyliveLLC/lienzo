<?php

declare(strict_types=1);

use Illuminate\Foundation\Auth\User;
use Orchestra\Testbench\Factories\UserFactory;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Tests\TestCase;

pest()->extend(TestCase::class)->in('Feature');

function editor(): User
{
    return UserFactory::new()->create(['email' => TestCase::EDITOR]);
}

/** A site with an editor signed in, and its editor endpoint. @return array{Site, string} */
function signedIn(): array
{
    test()->actingAs(editor());
    $site = Site::default();

    return [$site, "/admin/site/{$site->id}"];
}

/**
 * @param  array<string, mixed>  $props
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function element(string $type, string $id, array $props = [], array $extra = []): array
{
    return [
        'id' => $id,
        'type' => $type,
        'z' => 1,
        'layout' => ['desktop' => ['x' => 4, 'y' => 40, 'w' => 40, 'h' => 80], 'mobile' => null],
        'props' => $props,
        'style' => [],
        ...$extra,
    ];
}

/**
 * @param  list<array<string, mixed>>  $elements
 * @param  array<string, mixed>  $extra
 * @return array<string, mixed>
 */
function section(string $id, array $elements, array $extra = []): array
{
    return [
        'id' => $id,
        'height' => ['desktop' => 400, 'mobile' => 500],
        'background' => ['type' => 'color', 'color' => 'background'],
        'elements' => $elements,
        ...$extra,
    ];
}

/** @return array{sections: list<array<string, mixed>>} */
function document(array ...$sections): array
{
    return ['sections' => $sections];
}

/** A page whose draft and published copy are `$document`. */
function publishedPage(Site $site, array $document, string $slug = ''): Page
{
    return $site->pages()->create([
        'slug' => $slug,
        'title' => $slug === '' ? 'Home' : ucfirst($slug),
        'draft' => $document,
        'published' => $document,
        'published_slug' => $slug,
        'published_at' => now(),
    ]);
}
