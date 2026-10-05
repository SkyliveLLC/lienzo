<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\RouteCollection;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\HtmlString;
use Orchestra\Testbench\Factories\UserFactory;
use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\Site;

it('serves the published page, never the draft', function (): void {
    $site = Site::default();
    $page = publishedPage($site, document(section('hero', [element('heading', 'title', ['text' => 'Published words'])])));
    $page->update(['draft' => document(section('hero', [element('heading', 'title', ['text' => 'Draft words'])]))]);

    $this->get('/')
        ->assertOk()
        ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
        ->assertSee('Published words')
        ->assertDontSee('Draft words')
        ->assertSee('<link href="http://localhost" rel="canonical">', false);

    $this->get('/missing')->assertNotFound();
});

it('answers 404 until something is published', function (): void {
    Site::default()->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);

    $this->get('/')->assertNotFound();
    $this->get('/robots.txt')->assertOk()->assertDontSee('Sitemap');
});

it('renders app elements with live data on every visit', function (): void {
    Storage::fake('lienzo-test');
    $site = Site::default();
    [, $endpoint] = signedIn();
    $photo = $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->image('team.png', 100, 100)], ['Accept' => 'application/json'])->json('id');
    publishedPage($site, document(section('hero', [element('news', 'feed', ['heading' => 'Updates', 'photo' => "media:{$photo}"])])));

    config(['news' => ['First headline']]);
    $this->get('/')
        ->assertSee('<div class="news" data-look="cards"><h3>Updates at '.e($site->name).'</h3>'
            ."<img src=\"http://localhost/lienzo/media/{$photo}\" alt=\"\"><p>First headline</p></div>", false)
        ->assertSee('.lz-el[data-type="news"]{.news h3{margin:0}}', false);

    config(['news' => ['Second headline']]);
    $this->get('/')->assertSee('Second headline')->assertDontSee('First headline');
    $this->get("/lienzo/media/{$photo}")->assertOk()->assertHeader('Content-Type', 'image/webp');
});

it('links app actions through the app', function (): void {
    $site = Site::default();
    publishedPage($site, document(section('hero', [element('button', 'book', ['label' => 'Book now', 'action' => ['type' => 'booking', 'value' => null]])])));

    $this->get('/')->assertSee('href="/book?site='.$site->id.'"', false);
});

it('serves pages under the prefix the routes were given', function (): void {
    Route::setRoutes(new RouteCollection);
    Route::middleware('web')->group(fn () => Route::lienzo('site'));
    publishedPage(Site::default(), document(section('hero', [element('button', 'next', ['label' => 'Pricing', 'action' => ['type' => 'page', 'value' => 'pricing']])])));

    $this->get('/site')->assertOk()->assertSee('href="/site/pricing"', false);
    $this->get('/site/sitemap.xml')->assertSee('<loc>http://localhost/site</loc>', false);
});

it('serves the site the resolver picks for the request', function (): void {
    $first = Site::forOwner(UserFactory::new()->create(['email' => 'first@example.com']), ['name' => 'First']);
    $second = Site::forOwner(UserFactory::new()->create(['email' => 'second@example.com']), ['name' => 'Second']);
    publishedPage($first, document(section('hero', [element('heading', 'title', ['text' => 'First home'])])));
    publishedPage($second, document(section('hero', [element('heading', 'title', ['text' => 'Second home'])])));
    Lienzo::resolveSiteUsing(fn (Request $request): ?Site => Site::query()->where('name', ucfirst(explode('.', $request->getHost())[0]))->first());

    $this->get('http://second.test/')->assertSee('Second home')->assertDontSee('First home');
    $this->get('http://third.test/')->assertNotFound();
});

it('lets the app add head markup and uses the CSP nonce', function (): void {
    Vite::useCspNonce('n0nce');
    Lienzo::head(fn (Site $site): HtmlString => new HtmlString('<meta name="site-id" content="'.$site->id.'">'));
    $site = Site::default();
    publishedPage($site, document(section('hero', [])));

    $this->get('/')
        ->assertSee('<meta name="site-id" content="'.$site->id.'">', false)
        ->assertSee('<style nonce="n0nce">', false)
        ->assertSee('<script nonce="n0nce">', false);
});

it('lists published pages in the sitemap and points robots at it', function (): void {
    $site = Site::default();
    publishedPage($site, document(section('hero', [])));
    publishedPage($site, document(section('hero', [])), 'about');
    $site->pages()->create(['title' => 'Draft only', 'slug' => 'later', 'draft' => Page::BLANK]);

    $sitemap = $this->get('/sitemap.xml')->assertOk()->assertHeader('Content-Type', 'application/xml')->getContent();
    expect($sitemap)->toContain('<loc>http://localhost</loc>')
        ->toContain('<loc>http://localhost/about</loc>')
        ->not->toContain('later');

    $this->get('/robots.txt')->assertSee('Sitemap: http://localhost/sitemap.xml');
});

it('serves only images the published site uses', function (): void {
    Storage::fake('lienzo-test');
    Storage::disk('lienzo-test')->put('x.png', 'png');
    $image = fn (Site $site): int => $site->assets()->create(['name' => 'x.png', 'path' => 'x.png', 'mime' => 'image/png', 'size' => 3])->id;
    $site = Site::default();
    [$published, $draftOnly, $favicon] = [$image($site), $image($site), $image($site)];
    $theirs = $image(Site::forOwner(UserFactory::new()->create()));
    $site->update(['favicon' => "media:{$favicon}"]);
    $page = publishedPage($site, document(section('hero', [element('image', 'photo', ['src' => "media:{$published}"])])));
    $page->update(['draft' => document(section('hero', [element('image', 'photo', ['src' => "media:{$draftOnly}"])]))]);

    $this->get("/lienzo/media/{$published}")->assertOk()->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');
    $this->get("/lienzo/media/{$favicon}")->assertOk();
    $this->get("/lienzo/media/{$draftOnly}")->assertNotFound();
    $this->get("/lienzo/media/{$theirs}")->assertNotFound();
});
