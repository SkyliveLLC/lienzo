<?php

declare(strict_types=1);

use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Document\ParsedSiteSettings;
use Skylive\Lienzo\Render\PageInfo;
use Skylive\Lienzo\Render\RenderedPage;
use Skylive\Lienzo\Render\Renderer;
use Skylive\Lienzo\Render\RenderMode;
use Skylive\Lienzo\Tests\FixtureHost;
use Skylive\Lienzo\Tests\Fixtures;

/** Renders a fixtures/render input the way core's scripts/golden.ts does. */
function renderFixture(string $name): RenderedPage
{
    $input = Fixtures::json("render/{$name}.json");
    $catalog = Fixtures::catalog();

    return Renderer::renderPage(
        document: ParsedDocument::parse($input['document'], $catalog),
        catalog: $catalog,
        site: ParsedSiteSettings::parse($input['site']),
        page: new PageInfo($input['page']['slug'], $input['page']['seo'], $input['page']['url']),
        base: $input['base'],
        mode: RenderMode::from($input['mode']),
        host: new FixtureHost($input['host']),
    );
}

dataset('render goldens', fn (): array => array_combine(Fixtures::renderNames(), array_map(fn (string $name): array => [$name], Fixtures::renderNames())));

it('renders the same bytes as core', function (string $name): void {
    $page = renderFixture($name);
    // The goldens replace the inlined static files with markers; those are freshness-checked on their own.
    $html = str_replace(["\n".Assets::stylesheet(), "\n".Assets::runtime()], ["\n/* lienzo.css */\n", "\n/* runtime.js */\n"], $page->html);

    expect($html)->toBe(file_get_contents(Fixtures::path("render/{$name}.html")))
        ->and($page->css)->toBe(file_get_contents(Fixtures::path("render/{$name}.css")));
})->with('render goldens');
