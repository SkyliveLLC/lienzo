<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\RouteCollection;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Orchestra\Testbench\Factories\UserFactory;
use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\Models\Asset;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\Site;

/**
 * A host that decides who edits which site itself: no Route::lienzoEditor(),
 * the site of the signed-in user, who the `lienzo.manage` gate would refuse,
 * inside a group with a parameter of its own, as a Filament tenant route is.
 */
beforeEach(function (): void {
    Storage::fake('lienzo-test');
    Route::setRoutes(new RouteCollection);
    Route::middleware(['web', 'auth'])->prefix('{team}/studio')->group(function (): void {
        Route::match(['GET', 'POST', 'PUT', 'DELETE'], '{path?}', fn (Request $request) => Lienzo::editor(
            $request,
            Site::forOwner($request->user()),
            (string) $request->route('path'),
        ))->where('path', '.*');
    });

    $this->actingAs($this->user = UserFactory::new()->create());
    $this->site = Site::forOwner($this->user);
    $this->endpoint = 'http://localhost/acme/studio';
});

it('serves the workspace, pages and publishing from the host route', function (): void {
    $this->getJson($this->endpoint)->assertOk()->assertJsonPath('pages', []);

    $page = $this->postJson("{$this->endpoint}/pages", ['title' => 'Home', 'slug' => ''])->assertCreated()->json('id');
    $draft = document(section('hero', [element('heading', 'title', ['text' => 'Ours'])]));
    $this->putJson("{$this->endpoint}/pages/{$page}", ['baseRevision' => 1, 'draft' => $draft])->assertOk()->assertExactJson(['revision' => 2]);
    $this->postJson("{$this->endpoint}/pages/{$page}/publish", ['revision' => 2])->assertOk()->assertJsonCount(1, 'versions');

    expect($this->site->pages()->sole()->published)->toBe($draft);
});

it('returns image URLs under the host route, and serves them there', function (): void {
    $asset = $this->post("{$this->endpoint}/assets", ['file' => UploadedFile::fake()->image('team.png', 600, 600)], ['Accept' => 'application/json'])
        ->assertCreated()
        ->json();

    expect($asset['url'])->toBe("{$this->endpoint}/media/{$asset['id']}")
        ->and($asset['thumb'])->toBe("{$this->endpoint}/media/{$asset['id']}/thumb")
        ->and($this->site->assets()->sole()->id)->toBe($asset['id']);
    $this->get($asset['url'])->assertOk()->assertHeader('Content-Type', 'image/webp');
    $this->get($asset['thumb'])->assertOk()->assertHeader('Content-Type', 'image/webp');
    $this->getJson($this->endpoint)->assertJsonPath('assets.0.url', $asset['url']);
});

it('renders app element previews with image URLs under the host route', function (): void {
    $photo = $this->post("{$this->endpoint}/assets", ['file' => UploadedFile::fake()->image('team.png', 100, 100)], ['Accept' => 'application/json'])->json('id');

    $this->postJson("{$this->endpoint}/preview", ['elements' => [['id' => 'feed', 'type' => 'news', 'props' => ['photo' => "media:{$photo}"]]]])
        ->assertOk()
        ->assertJsonPath('feed', fn (string $html): bool => str_contains($html, "<img src=\"{$this->endpoint}/media/{$photo}\""));
});

it('answers 404 for a path outside the protocol, 405 for the wrong method, and HEAD like GET', function (): void {
    $this->getJson("{$this->endpoint}/nope")->assertNotFound();
    $this->getJson("{$this->endpoint}/pages/first")->assertNotFound();
    $this->getJson("{$this->endpoint}/pages")->assertMethodNotAllowed()->assertHeader('Allow', 'POST');
    $this->deleteJson("{$this->endpoint}/site")->assertMethodNotAllowed()->assertHeader('Allow', 'PUT');
    $this->call('HEAD', "{$this->endpoint}/submissions")->assertOk();
});

it('never reaches another site\'s page, version or image by id', function (): void {
    $other = Site::forOwner(UserFactory::new()->create());
    $page = publishedPage($other, Page::BLANK);
    $version = $page->versions()->create(['document' => Page::BLANK]);
    $asset = $other->assets()->create(['name' => 'x.png', 'path' => 'x.png', 'mime' => 'image/png', 'size' => 3]);

    $this->getJson("{$this->endpoint}/pages/{$page->id}")->assertNotFound();
    $this->putJson("{$this->endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'title' => 'Mine'])->assertNotFound();
    $this->postJson("{$this->endpoint}/pages/{$page->id}/publish", ['revision' => 1])->assertNotFound();
    $this->postJson("{$this->endpoint}/pages/{$page->id}/versions/{$version->id}/restore")->assertNotFound();
    $this->deleteJson("{$this->endpoint}/pages/{$page->id}")->assertNotFound();
    $this->deleteJson("{$this->endpoint}/assets/{$asset->id}")->assertNotFound();
    $this->get("{$this->endpoint}/media/{$asset->id}")->assertNotFound();

    expect($page->fresh()->title)->toBe('Home')->and(Asset::query()->find($asset->id))->not->toBeNull();
});
