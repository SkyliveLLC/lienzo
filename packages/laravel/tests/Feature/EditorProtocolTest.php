<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Exceptions;
use Orchestra\Testbench\Factories\UserFactory;
use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\Field;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\Site;

it('opens the workspace with the app catalog', function (): void {
    [$site, $endpoint] = signedIn();
    $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);

    $this->getJson($endpoint)
        ->assertOk()
        ->assertJsonPath('site.name', $site->name)
        ->assertJsonPath('site.theme.primary', '#2563eb')
        ->assertJsonPath('pages.0.slug', '')
        ->assertJsonPath('catalog.elements.0.type', 'news')
        ->assertJsonPath('catalog.elements.0.fields.1', ['kind' => 'number', 'key' => 'limit', 'label' => ['en' => 'How many'], 'min' => 1, 'max' => 5, 'default' => 2])
        ->assertJsonPath('catalog.actions.0', ['type' => 'booking', 'label' => ['en' => 'Book online'], 'value' => null])
        ->assertJsonPath('quota', ['used' => 0, 'limit' => 200 * 1024 * 1024])
        ->assertJsonPath('publicUrl', 'http://localhost');
});

it('lets only users the gate allows reach a site', function (): void {
    $site = Site::default();
    $page = $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);

    $this->getJson("/admin/site/{$site->id}")->assertUnauthorized();
    $this->actingAs(UserFactory::new()->create())->getJson("/admin/site/{$site->id}")->assertForbidden();
    $this->actingAs(UserFactory::new()->create())->putJson("/admin/site/{$site->id}/pages/{$page->id}", ['baseRevision' => 1, 'title' => 'Mine'])->assertForbidden();

    expect($page->fresh()->title)->toBe('Home');
});

it('keeps pages, versions and images inside their site', function (): void {
    [, $endpoint] = signedIn();
    $other = Site::forOwner(UserFactory::new()->create());
    $page = publishedPage($other, Page::BLANK);
    $version = $page->versions()->create(['document' => Page::BLANK]);
    $asset = $other->assets()->create(['name' => 'x.png', 'path' => 'x.png', 'mime' => 'image/png', 'size' => 3]);

    $this->getJson("{$endpoint}/pages/{$page->id}")->assertNotFound();
    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'title' => 'Mine'])->assertNotFound();
    $this->postJson("{$endpoint}/pages/{$page->id}/publish", ['revision' => 1])->assertNotFound();
    $this->postJson("{$endpoint}/pages/{$page->id}/versions/{$version->id}/restore")->assertNotFound();
    $this->deleteJson("{$endpoint}/pages/{$page->id}")->assertNotFound();
    $this->deleteJson("{$endpoint}/assets/{$asset->id}")->assertNotFound();
    $this->get("{$endpoint}/media/{$asset->id}")->assertNotFound();

    expect($page->fresh()->title)->toBe('Home')->and($asset->fresh())->not->toBeNull();
});

it('answers conflicts and invalid input without reporting them as errors', function (): void {
    Exceptions::fake();
    [$site, $endpoint] = signedIn();
    $page = $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 7])->assertConflict();
    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'slug' => 'No Spaces'])->assertUnprocessable();

    Exceptions::assertNothingReported();
});

it('creates pages with unique addresses', function (): void {
    [, $endpoint] = signedIn();

    $this->postJson("{$endpoint}/pages", ['title' => 'Home', 'slug' => ''])
        ->assertCreated()
        ->assertJsonPath('revision', 1)
        ->assertJsonPath('draft', Page::BLANK)
        ->assertJsonPath('versions', []);

    $this->postJson("{$endpoint}/pages", ['title' => 'Again', 'slug' => ''])
        ->assertUnprocessable()
        ->assertJsonPath('issues', [['path' => 'slug', 'code' => 'unique', 'message' => 'Another page already uses this address.']]);

    $this->postJson("{$endpoint}/pages", ['title' => '', 'slug' => 'Not A Slug'])
        ->assertUnprocessable()
        ->assertJsonPath('issues.*.path', ['title', 'slug'])
        ->assertJsonPath('issues.*.code', ['required', 'pattern']);
});

it('saves a draft byte for byte and refuses a stale revision', function (): void {
    [$site, $endpoint] = signedIn();
    $page = $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);
    $draft = document(section('hero', [element('text', 'intro', ['text' => "  Two spaces, then a line break\n"])]));

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'title' => 'Welcome', 'draft' => $draft])
        ->assertOk()
        ->assertExactJson(['revision' => 2]);

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'title' => 'From an old tab'])
        ->assertConflict()
        ->assertJsonPath('revision', 2);

    $page->refresh();
    expect($page->title)->toBe('Welcome')
        ->and($page->revision)->toBe(2)
        ->and($page->draft['sections'][0]['elements'][0]['props']['text'])->toBe("  Two spaces, then a line break\n");
});

it('reports invalid drafts with paths into the draft', function (): void {
    [$site, $endpoint] = signedIn();
    $page = $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);
    $injected = element('heading', 'title', ['text' => 'Hi'], ['style' => ['color' => 'red;background:url(x)']]);

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'draft' => document(section('hero', [$injected]))])
        ->assertUnprocessable()
        ->assertJsonPath('issues.*.path', ['draft.sections.0.elements.0.style.color']);

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'draft' => document(section('hero', [element('news', 'feed', ['limit' => 99])]))])
        ->assertUnprocessable()
        ->assertJsonPath('issues.*.path', ['draft.sections.0.elements.0.props.limit'])
        ->assertJsonPath('issues.*.code', ['range']);

    expect($page->fresh()->revision)->toBe(1);
});

it('refuses two forms that would share a submission id', function (): void {
    [$site, $endpoint] = signedIn();
    $page = $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);
    $form = fn (): array => [element('input', 'email', ['label' => 'Email']), element('button', 'send', ['label' => 'Send', 'action' => ['type' => 'submit']])];
    $draft = [...document(section('contact', $form())), 'modals' => [[
        'id' => 'contact', 'title' => 'Contact', 'width' => 520, 'height' => ['desktop' => 320, 'mobile' => 420],
        'background' => ['type' => 'color', 'color' => 'background'], 'elements' => $form(),
    ]]];

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'draft' => $draft])
        ->assertUnprocessable()
        ->assertJsonPath('issues.0.path', 'draft')
        ->assertJsonPath('issues.0.code', 'unique');
});

it('keeps elements of types nobody registered through a save', function (): void {
    [$site, $endpoint] = signedIn();
    $page = $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => Page::BLANK]);
    $plugin = element('map-widget', 'map', ['zoom' => 12, 'pins' => [['lat' => 1.5, 'label' => 'Office']]]);

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'draft' => document(section('hero', [$plugin]))])->assertOk();

    $this->getJson("{$endpoint}/pages/{$page->id}")
        ->assertJsonPath('draft.sections.0.elements.0.type', 'map-widget')
        ->assertJsonPath('draft.sections.0.elements.0.props', $plugin['props']);
});

it('publishes once per change and restores versions', function (): void {
    [$site, $endpoint] = signedIn();
    $first = document(section('hero', [element('heading', 'title', ['text' => 'First'])]));
    $page = $site->pages()->create(['title' => 'Home', 'slug' => '', 'draft' => $first]);

    $published = $this->postJson("{$endpoint}/pages/{$page->id}/publish", ['revision' => 1])
        ->assertOk()
        ->assertJsonCount(1, 'versions')
        ->assertJsonPath('versions.0.by', auth()->user()->name)
        ->json();

    $this->travel(1)->minutes();
    $this->postJson("{$endpoint}/pages/{$page->id}/publish", ['revision' => 1])
        ->assertOk()
        ->assertJsonCount(1, 'versions')
        ->assertJsonPath('publishedAt', $published['publishedAt']);

    $second = document(section('hero', [element('heading', 'title', ['text' => 'Second'])]));
    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'draft' => $second])->assertOk();
    $this->postJson("{$endpoint}/pages/{$page->id}/publish", ['revision' => 1])->assertConflict();
    $this->postJson("{$endpoint}/pages/{$page->id}/publish", ['revision' => 2])->assertOk()->assertJsonCount(2, 'versions');

    expect($page->fresh()->published['sections'][0]['elements'][0]['props']['text'])->toBe('Second');

    $oldest = $page->versions()->oldest('id')->first();
    $this->postJson("{$endpoint}/pages/{$page->id}/versions/{$oldest->id}/restore")
        ->assertOk()
        ->assertJsonPath('revision', 3)
        ->assertJsonPath('draft.sections.0.elements.0.props.text', 'First');

    expect($page->fresh()->published['sections'][0]['elements'][0]['props']['text'])->toBe('Second');
});

it('keeps the live address and tags until the page is published again', function (): void {
    [$site, $endpoint] = signedIn();
    $page = publishedPage($site, document(section('hero', [element('heading', 'title', ['text' => 'About us'])])), 'about');
    $page->update(['seo' => ['title' => 'About'], 'published_seo' => ['title' => 'About']]);

    $this->putJson("{$endpoint}/pages/{$page->id}", ['baseRevision' => 1, 'slug' => 'team', 'seo' => ['title' => 'Our team']])->assertOk();
    $this->postJson("{$endpoint}/pages", ['title' => 'Taken', 'slug' => 'about'])->assertJsonPath('issues.0.code', 'unique');

    $this->get('/about')->assertOk()->assertSee('<title>About</title>', false);
    $this->get('/team')->assertNotFound();

    $this->postJson("{$endpoint}/pages/{$page->id}/publish", ['revision' => 2])->assertOk()->assertJsonCount(0, 'versions');

    $this->get('/about')->assertNotFound();
    $this->get('/team')->assertOk()->assertSee('<title>Our team</title>', false);
});

it('keeps every value a site field that takes several was given', function (): void {
    Lienzo::siteFields(Field::choice('services', 'Services', ['cleaning' => 'Cleaning', 'braces' => 'Braces'])->multiple());
    [$site, $endpoint] = signedIn();

    $this->putJson("{$endpoint}/site", ['meta' => ['services' => ['cleaning', 'braces']]])
        ->assertOk()
        ->assertJsonPath('meta.services', ['cleaning', 'braces'])
        ->assertJsonPath('catalog.siteFields.0.multiple', true)
        ->assertJsonPath('catalog.siteFields.0.default', []);

    $this->putJson("{$endpoint}/site", ['meta' => ['services' => ['cleaning', 'implants']]])
        ->assertUnprocessable()
        ->assertJsonPath('issues.*.path', ['meta.services.1']);

    expect($site->fresh()->meta['services'])->toBe(['cleaning', 'braces']);
});

it('updates the theme, seo and site fields, checked like the document', function (): void {
    Lienzo::siteFields(Field::text('phone', 'Phone', max: 30), Field::toggle('chat', 'Show chat'));
    [$site, $endpoint] = signedIn();

    $this->putJson("{$endpoint}/site", [
        'theme' => ['primary' => '#ff0000', 'heading_font' => 'Playfair Display'],
        'seo' => ['title' => 'Our place'],
        'meta' => ['phone' => '+1 555 0100', 'unknown' => 'dropped'],
    ])
        ->assertOk()
        ->assertJsonPath('site.theme.primary', '#ff0000')
        ->assertJsonPath('site.theme.secondary', '#0f172a')
        ->assertJsonPath('site.seo.title', 'Our place')
        ->assertJsonPath('meta', ['phone' => '+1 555 0100'])
        ->assertJsonPath('catalog.siteFields.1.key', 'chat');

    $this->putJson("{$endpoint}/site", ['theme' => ['heading_font' => "Inter'; } body { color: red"], 'meta' => ['chat' => 'yes']])
        ->assertUnprocessable()
        ->assertJsonPath('issues.*.path', ['theme.heading_font']);

    $this->putJson("{$endpoint}/site", ['meta' => ['chat' => 'yes']])
        ->assertUnprocessable()
        ->assertJsonPath('issues.*.path', ['meta.chat']);

    expect($site->fresh()->theme['heading_font'])->toBe('Playfair Display');
});

it('previews app elements with the code the public page uses', function (): void {
    config(['news' => ['Opening hours change', 'New team member', 'Third item']]);
    [$site, $endpoint] = signedIn();

    $this->postJson("{$endpoint}/preview", ['elements' => [
        ['id' => 'feed', 'type' => 'news', 'props' => ['look' => 'list']],
        ['id' => 'gone', 'type' => 'map-widget', 'props' => []],
    ]])
        ->assertOk()
        ->assertExactJson(['feed' => '<div class="news" data-look="list"><h3>Latest at '.e($site->name).'</h3><p>Opening hours change</p><p>New team member</p></div>']);

    $this->postJson("{$endpoint}/preview", ['elements' => [['id' => 'feed', 'type' => 'news', 'props' => ['look' => 'grid']]]])
        ->assertUnprocessable()
        ->assertJsonPath('issues.0.path', 'elements.0.props.look');
});

it('lists submissions newest first, a page at a time', function (): void {
    [$site, $endpoint] = signedIn();

    foreach (range(1, 25) as $n) {
        $site->submissions()->create(['page' => '', 'source' => 'contact', 'fields' => [
            ['name' => 'name', 'label' => 'Name', 'value' => "Visitor {$n}"],
            ['name' => 'other', 'label' => 'Name', 'value' => 'Same label'],
        ]]);
    }

    $first = $this->getJson("{$endpoint}/submissions")
        ->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonPath('data.0.fields', ['Name' => 'Visitor 25', 'Name (2)' => 'Same label'])
        ->json();

    $this->getJson("{$endpoint}/submissions?cursor={$first['next']}")
        ->assertJsonCount(5, 'data')
        ->assertJsonPath('data.4.fields.Name', 'Visitor 1')
        ->assertJsonPath('next', null);
});

it('deletes pages', function (): void {
    [$site, $endpoint] = signedIn();
    $page = $site->pages()->create(['title' => 'About', 'slug' => 'about', 'draft' => Page::BLANK]);

    $this->deleteJson("{$endpoint}/pages/{$page->id}")->assertOk()->assertContent('null');

    expect(Page::query()->count())->toBe(0);
});
