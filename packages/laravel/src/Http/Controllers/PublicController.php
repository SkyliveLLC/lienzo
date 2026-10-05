<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Skylive\Lienzo\AssetLibrary;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Http\Routes;
use Skylive\Lienzo\Http\SessionForm;
use Skylive\Lienzo\LienzoManager;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Render\Canvas;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The public side registered by `Route::lienzo()`: published pages, their
 * forms and images, and the files search engines read. Every route serves
 * the site `Lienzo::resolveSiteUsing()` picks for the request. Route
 * parameters are read by name, so the routes work inside a group with
 * parameters of its own (a `{tenant}` domain).
 *
 * @phpstan-import-type FormField from Canvas
 */
final class PublicController
{
    public function __construct(private readonly LienzoManager $lienzo) {}

    public function page(Request $request): Response
    {
        return $this->lienzo->page($request, $request->route('slug')) ?? abort(404);
    }

    /**
     * Stores what a form on a published page sent. The fields accepted are
     * the ones that form has on the published page, whatever the browser posts.
     */
    public function submit(Request $request): RedirectResponse
    {
        $site = $this->site($request);
        $data = $request->validate([
            'slug' => ['nullable', 'string', 'max:120'],
            'source' => ['required', 'string', 'max:40'],
        ]);
        $sent = $this->lienzo->message('sent', $site->settings()->locale);

        // Bots fill the hidden field; they get the same answer and nothing is stored.
        if (filled($request->input('website'))) {
            return back()->with(SessionForm::NOTICE, $sent);
        }

        $page = $site->pages()->published()->where('published_slug', $data['slug'] ?? '')->first();
        $form = $page === null ? null : collect(Canvas::formFields(ParsedDocument::parse($page->published, $this->lienzo->catalog())))
            ->firstWhere('source', $data['source']);

        if ($form === null) {
            throw ValidationException::withMessages(['source' => 'This form is no longer available.']);
        }

        $fields = $form['fields'];
        $answers = $request->validate(
            array_merge(...array_map(fn (array $field): array => ["fields.{$field['name']}" => self::rules($field)], $fields)),
            [],
            array_merge(...array_map(fn (array $field): array => ["fields.{$field['name']}" => $field['label']], $fields)),
        )['fields'] ?? [];

        $site->submissions()->create([
            'page' => $page->published_slug,
            'source' => $data['source'],
            'fields' => array_map(fn (array $field): array => [
                'name' => $field['name'],
                'label' => $field['label'],
                'value' => $field['kind'] === 'checkbox'
                    ? (filled($answers[$field['name']] ?? null) ? 'yes' : 'no')
                    : (string) ($answers[$field['name']] ?? ''),
            ], $fields),
            'ip' => $request->ip(),
        ]);

        return back()->with(SessionForm::NOTICE, $sent);
    }

    public function media(Request $request, AssetLibrary $library): StreamedResponse
    {
        $site = $this->site($request);
        $asset = $site->assets()->findOrFail($request->route('lienzoAsset'));

        abort_unless($site->publishes($asset), 404);

        return $library->response($asset, $request->route('size') === 'thumb', public: true);
    }

    public function sitemap(Request $request): Response
    {
        $site = $this->site($request);
        $urls = $site->pages()->published()->orderBy('published_slug')->get(['published_slug', 'published_at'])->map(fn (Page $page): string => '<url>'
            .'<loc>'.e(Routes::url('lienzo.page', ['slug' => $page->published_slug ?: null])).'</loc>'
            .'<lastmod>'.$page->published_at?->toDateString().'</lastmod>'
            .'</url>');

        return new Response(
            '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'.$urls->implode('').'</urlset>',
            200,
            ['Content-Type' => 'application/xml'],
        );
    }

    public function robots(Request $request): Response
    {
        $published = $this->lienzo->resolveSite($request)?->pages()->published()->exists() ?? false;
        $lines = ['User-agent: *', 'Disallow:', ...($published ? ['Sitemap: '.Routes::url('lienzo.sitemap')] : [])];

        return new Response(implode("\n", $lines)."\n", 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    private function site(Request $request): Site
    {
        return $this->lienzo->resolveSite($request) ?? abort(404);
    }

    /**
     * @param  FormField  $field
     * @return list<mixed>
     */
    private static function rules(array $field): array
    {
        $presence = $field['required'] ? 'required' : 'nullable';

        return match ($field['kind']) {
            'checkbox' => [$field['required'] ? 'accepted' : 'nullable'],
            'select' => [$presence, Rule::in($field['options'])],
            'textarea' => [$presence, 'string', 'max:2000'],
            'input' => [$presence, ...match ($field['inputType']) {
                'email' => ['email', 'max:120'],
                'tel' => ['string', 'max:30'],
                'number' => ['numeric'],
                'date' => ['date'],
                default => ['string', 'max:500'],
            }],
        };
    }
}
