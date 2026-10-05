<?php

declare(strict_types=1);

use Illuminate\Testing\TestResponse;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Models\Submission;

/** @return array<string, mixed> */
function field(string $type, string $id, string $label, array $props = []): array
{
    return element($type, $id, ['label' => $label, 'placeholder' => '', 'required' => false, 'input_type' => 'text', 'options' => [], ...$props]);
}

function contactSection(string $id = 'contact'): array
{
    return section($id, [
        field('input', 'name', 'Your name', ['required' => true]),
        field('input', 'email', 'Email', ['input_type' => 'email']),
        field('select', 'topic', 'Topic', ['options' => ['Sales', 'Support']]),
        field('textarea', 'message', 'Message'),
        field('checkbox', 'consent', 'I agree', ['required' => true]),
        element('button', 'send', ['label' => 'Send', 'action' => ['type' => 'submit', 'value' => null]]),
    ]);
}

/**
 * Submits a form of the page at `$url` the way a browser does: the input
 * names the page rendered, form-encoded, then parsed by PHP's own rules.
 * `$values` are keyed by element id.
 *
 * @param  array<string, string>  $values
 */
function submitForm(string $url, string $source, array $values): TestResponse
{
    $html = test()->get($url)->assertOk()->getContent();
    $form = collect(explode('<form', $html))->first(fn (string $chunk): bool => str_contains($chunk, 'name="source" type="hidden" value="'.$source.'"'));
    expect($form)->not->toBeNull("no form posts source {$source}");

    preg_match_all('/<input name="([^"]+)" type="hidden" value="([^"]*)">/', $form, $hidden, PREG_SET_ORDER);
    $pairs = array_map(fn (array $match): string => urlencode($match[1]).'='.urlencode(html_entity_decode($match[2])), $hidden);

    foreach ($values as $id => $value) {
        expect(preg_match('/name="([^"]*\b'.preg_quote($id).'\b[^"]*)"/', $form, $name))->toBe(1, "no input for {$id}");
        $pairs[] = urlencode($name[1]).'='.urlencode($value);
    }

    parse_str(implode('&', $pairs), $body);

    return test()->from($url)->post('/lienzo/submit', $body);
}

it('stores what a browser posts, read through the names the page renders', function (): void {
    publishedPage(Site::default(), document(contactSection()));

    submitForm('/', 'contact', ['name' => 'Ana', 'email' => 'ana@example.com', 'topic' => 'Support', 'consent' => '1'])
        ->assertRedirect('/')
        ->assertSessionHasNoErrors();

    expect(Submission::query()->sole())
        ->page->toBe('')
        ->source->toBe('contact')
        ->fields->toBe([
            ['name' => 'name', 'label' => 'Your name', 'value' => 'Ana'],
            ['name' => 'email', 'label' => 'Email', 'value' => 'ana@example.com'],
            ['name' => 'topic', 'label' => 'Topic', 'value' => 'Support'],
            ['name' => 'message', 'label' => 'Message', 'value' => ''],
            ['name' => 'consent', 'label' => 'I agree', 'value' => 'yes'],
        ]);

    $this->get('/')->assertSee('<p class="lz-notice" role="status">Thanks! We received your message.</p>', false);
});

it('needs the CSRF token the page renders', function (): void {
    $this->app['env'] = 'production';
    publishedPage(Site::default(), document(contactSection()));

    $this->from('/')->post('/lienzo/submit', ['slug' => '', 'source' => 'contact', 'fields' => ['name' => 'Ana', 'consent' => '1']])
        ->assertStatus(419);
    submitForm('/', 'contact', ['name' => 'Ana', 'consent' => '1'])->assertRedirect('/')->assertSessionHasNoErrors();

    expect(Submission::query()->count())->toBe(1);
});

it('sends the visitor back with their input and the errors', function (): void {
    publishedPage(Site::default(), document(contactSection()));

    submitForm('/', 'contact', ['email' => 'not-an-email', 'topic' => 'Gossip'])
        ->assertRedirect('/')
        ->assertSessionHasErrors(['fields.name', 'fields.email', 'fields.topic', 'fields.consent']);

    $this->get('/')
        ->assertSee('<em class="lz-field-error">The Your name field is required.</em>', false)
        ->assertSee('value="not-an-email"', false)
        ->assertDontSee('class="lz-notice"', false);
    expect(Submission::query()->count())->toBe(0);
});

it('accepts only the forms and fields of the published page', function (): void {
    $site = Site::default();
    $page = publishedPage($site, document(contactSection()));
    $page->update(['draft' => document(contactSection(), contactSection('draft-form'))]);

    $this->from('/')->post('/lienzo/submit', ['slug' => '', 'source' => 'contact', 'fields' => ['name' => 'Ana', 'consent' => '1', 'admin' => 'yes']])
        ->assertSessionHasNoErrors();
    $this->from('/')->post('/lienzo/submit', ['slug' => '', 'source' => 'draft-form', 'fields' => ['name' => 'Ana', 'consent' => '1']])
        ->assertSessionHasErrors('source');

    expect(Submission::query()->sole()->fields)->not->toContain(['name' => 'admin', 'label' => '', 'value' => 'yes'])
        ->and(array_column(Submission::query()->sole()->fields, 'name'))->toBe(['name', 'email', 'topic', 'message', 'consent']);
});

it('answers bots that fill the hidden field as if they succeeded, and stores nothing', function (): void {
    publishedPage(Site::default(), document(contactSection()));

    $this->from('/')->post('/lienzo/submit', ['slug' => '', 'source' => 'contact', 'website' => 'http://spam.example', 'fields' => ['name' => 'Bot', 'consent' => '1']])
        ->assertRedirect('/')
        ->assertSessionHas('lienzo.notice');

    expect(Submission::query()->count())->toBe(0);
});

it('limits how often one visitor can submit', function (): void {
    publishedPage(Site::default(), document(contactSection()));
    $post = fn (): TestResponse => $this->from('/')->post('/lienzo/submit', ['slug' => '', 'source' => 'contact', 'fields' => ['name' => 'Ana', 'consent' => '1']]);

    foreach (range(1, 10) as $attempt) {
        $post()->assertRedirect('/');
    }

    $post()->assertTooManyRequests();
    expect(Submission::query()->count())->toBe(10);
});

it('collects every step of a steps form in one submission', function (): void {
    $steps = ['group' => ['id' => 'booking', 'type' => 'steps', 'label' => null]];
    publishedPage(Site::default(), document(
        section('who', [field('input', 'name', 'Name', ['required' => true]), element('button', 'next', ['label' => 'Next', 'action' => ['type' => 'step_next']])], $steps),
        section('what', [field('select', 'service', 'Service', ['options' => ['Cleaning', 'Check-up']])], $steps),
        section('confirm', [field('checkbox', 'agree', 'I agree', ['required' => true]), element('button', 'send', ['label' => 'Send', 'action' => ['type' => 'submit']])], $steps),
    ));

    submitForm('/', 'booking', ['agree' => '1', 'service' => 'Cleaning'])->assertSessionHasErrors(['fields.name']);
    submitForm('/', 'booking', ['name' => 'Ana', 'service' => 'Cleaning', 'agree' => '1'])->assertSessionHasNoErrors();

    expect(array_column(Submission::query()->sole()->fields, 'value', 'name'))->toBe(['name' => 'Ana', 'service' => 'Cleaning', 'agree' => 'yes']);
});
