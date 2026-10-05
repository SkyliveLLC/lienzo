<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\RouteCollection;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Orchestra\Testbench\Factories\UserFactory;
use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Models\Submission;

/** A multi-site app serving each site on its own domain, read from a route parameter. */
beforeEach(function (): void {
    Storage::fake('lienzo-test');
    Route::setRoutes(new RouteCollection);
    Route::domain('{siteDomain}')->where(['siteDomain' => '[a-z0-9.-]+'])->middleware('web')->group(function (): void {
        Route::lienzoEditor('admin/site');
        Route::get('admin/editor', fn (): string => Blade::render('<x-lienzo::editor :site="$site" />', ['site' => Site::query()->sole()]));
        Route::lienzo();
    });
    Lienzo::resolveSiteUsing(fn (Request $request): ?Site => Site::query()->where('name', $request->route('siteDomain'))->first());

    $this->site = Site::forOwner(UserFactory::new()->create(), ['name' => 'north.test']);
    $this->endpoint = "http://north.test/admin/site/{$this->site->id}";
    $this->actingAs(editor());
});

it('serves pages, images, forms, the sitemap and robots.txt inside a domain group with a parameter', function (): void {
    $photo = $this->post("{$this->endpoint}/assets", ['file' => UploadedFile::fake()->image('team.png', 100, 100)], ['Accept' => 'application/json'])
        ->assertCreated()->json('id');
    publishedPage($this->site, document(section('contact', [
        element('news', 'feed', ['heading' => 'Updates', 'photo' => "media:{$photo}"]),
        element('input', 'name', ['label' => 'Your name', 'placeholder' => '', 'required' => true, 'input_type' => 'text', 'options' => []]),
        element('button', 'send', ['label' => 'Send', 'action' => ['type' => 'submit', 'value' => null]]),
    ])));
    publishedPage($this->site, document(section('hero', [element('heading', 'title', ['text' => 'About north'])])), 'about');

    $this->get('http://north.test/about')->assertOk()->assertSee('About north');
    $this->get('http://north.test/')
        ->assertSee("src=\"http://north.test/lienzo/media/{$photo}\"", false)
        ->assertSee('action="http://north.test/lienzo/submit"', false);
    $this->get("http://north.test/lienzo/media/{$photo}")->assertOk()->assertHeader('Content-Type', 'image/webp');
    $this->get('http://north.test/sitemap.xml')->assertSee('<loc>http://north.test/about</loc>', false);
    $this->get('http://north.test/robots.txt')->assertSee('Sitemap: http://north.test/sitemap.xml');

    $this->from('http://north.test/')->post('http://north.test/lienzo/submit', ['slug' => '', 'source' => 'contact', 'fields' => ['name' => 'Ana']])
        ->assertRedirect('http://north.test/')
        ->assertSessionHasNoErrors();
    expect(Submission::query()->sole())->site_id->toBe($this->site->id);
});

it('serves the editor inside a domain group with a parameter', function (): void {
    $page = publishedPage($this->site, document(section('hero', [element('heading', 'title', ['text' => 'Home'])])));
    $asset = $this->post("{$this->endpoint}/assets", ['file' => UploadedFile::fake()->image('team.png', 100, 100)], ['Accept' => 'application/json'])
        ->assertCreated()->json();

    expect($asset['url'])->toBe("{$this->endpoint}/media/{$asset['id']}");
    $this->get($asset['url'])->assertOk();
    $this->getJson($this->endpoint)->assertOk()->assertJsonPath('publicUrl', 'http://north.test');
    $this->getJson("{$this->endpoint}/pages/{$page->id}")->assertOk()->assertJsonPath('title', 'Home');
    $this->get('http://north.test/admin/editor')
        ->assertSee('src="http://north.test/admin/site/lienzo-editor.js?v=', false)
        ->assertSee('endpoint="'.$this->endpoint.'"', false);
});
