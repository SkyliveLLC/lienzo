<?php

declare(strict_types=1);

namespace Skylive\Lienzo;

use Closure;
use Illuminate\Contracts\Container\Container;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Exceptions\UrlGenerationException;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Vite;
use LogicException;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Http\PageHost;
use Skylive\Lienzo\Http\SessionForm;
use Skylive\Lienzo\Models\Asset;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Render\Messages;
use Skylive\Lienzo\Render\PageInfo;
use Skylive\Lienzo\Render\RenderedPage;
use Skylive\Lienzo\Render\Renderer;
use Skylive\Lienzo\Render\RenderMode;
use Skylive\Lienzo\Render\TrustedHtml;

/**
 * What the app tells Lienzo, and the public render built from it. Reached
 * through the `Lienzo` facade; one instance per application.
 *
 * @phpstan-import-type Localized from Field
 * @phpstan-import-type FieldSpec from Field
 *
 * @phpstan-type ActionSpec array{type: string, label: Localized, value: FieldSpec|null}
 * @phpstan-type Catalog array{elements: list<array<string, mixed>>, actions: list<ActionSpec>, siteFields?: list<FieldSpec>}
 */
final class LienzoManager
{
    /** @var (Closure(Request): ?Site)|null */
    private ?Closure $siteResolver = null;

    /** @var array<string, Element> by type */
    private array $elements = [];

    /** @var array<string, array{spec: ActionSpec, href: Closure(?string, Site): ?string}> by type */
    private array $actions = [];

    /** @var list<Field> */
    private array $siteFields = [];

    /** @var (Closure(Site): ?Htmlable)|null */
    private ?Closure $head = null;

    /** @var (Closure(Site): ?string)|null */
    private ?Closure $publicUrl = null;

    /** @var array<string, array<string, string>> public page strings by locale, over the ones core ships */
    private array $messages = [
        'en' => ['sent' => 'Thanks! We received your message.'],
        'es' => ['sent' => '¡Gracias! Recibimos tu mensaje.'],
    ];

    public function __construct(private readonly Container $container) {}

    /**
     * Which site a public request is for. The default is the ownerless site of a single-site app.
     *
     * @param  Closure(Request): ?Site  $resolver
     */
    public function resolveSiteUsing(Closure $resolver): void
    {
        $this->siteResolver = $resolver;
    }

    /** @param class-string<Element>|Element $element */
    public function element(string|Element $element): void
    {
        $element = is_string($element) ? $this->container->make($element) : $element;
        $type = $element->type();

        if (preg_match('/^[a-z][a-z0-9_-]{0,39}$/D', $type) !== 1 || in_array($type, Assets::data()['elementTypes'], true)) {
            throw new LogicException("Element type [{$type}] must match ^[a-z][a-z0-9_-]{0,39}$ and not be a core type.");
        }

        if (! array_key_exists($element->toArray()['icon'], Assets::data()['icons'])) {
            throw new LogicException("Element [{$type}] uses an icon that is not in core's catalog.");
        }

        $this->elements[$type] = $element;
    }

    /**
     * An app action, e.g. `booking`. `$href` turns the stored value into a link, or null to render it inert.
     *
     * @param  string|Localized  $label
     * @param  Closure(?string $value, Site $site): ?string  $href
     * @param  Field|null  $value  what the editor asks for, or null when the action takes no input
     */
    public function action(string $type, string|array $label, Closure $href, ?Field $value = null): void
    {
        if (preg_match('/^[a-z][a-z0-9_]{0,39}$/D', $type) !== 1 || array_key_exists($type, Assets::data()['actions'])) {
            throw new LogicException("Action type [{$type}] must match ^[a-z][a-z0-9_]{0,39}$ and not be a core action.");
        }

        $this->actions[$type] = [
            'spec' => ['type' => $type, 'label' => Field::localized($label), 'value' => $value?->toArray()],
            'href' => $href,
        ];
    }

    /** App-specific site data (an address, an analytics id), stored in the site's `meta` and edited in site settings. */
    public function siteFields(Field ...$fields): void
    {
        $this->siteFields = array_values($fields);
    }

    /**
     * Extra trusted `<head>` markup per site (structured data, analytics). Developer code only.
     *
     * @param  Closure(Site): ?Htmlable  $head
     */
    public function head(Closure $head): void
    {
        $this->head = $head;
    }

    /**
     * Public page strings for a locale, merged over the shipped English and Spanish.
     *
     * @param  array<string, string>  $messages
     */
    public function messages(string $locale, array $messages): void
    {
        $this->messages[$locale] = [...$this->messages[$locale] ?? [], ...$messages];
    }

    /**
     * Where a site is served, for the editor's "view site" link. The default
     * is the `lienzo.page` route when it needs no parameters.
     *
     * @param  Closure(Site): ?string  $url
     */
    public function publicUrlUsing(Closure $url): void
    {
        $this->publicUrl = $url;
    }

    /**
     * The published page for this request, or null when there is no site or
     * no such published page, so the app decides what that means.
     * `Route::lienzo()` is this plus a 404.
     */
    public function page(Request $request, ?string $slug = null): ?Response
    {
        $site = $this->resolveSite($request);
        $page = $site?->pages()->published()->where('published_slug', $slug ?? '')->first();

        if ($site === null || $page === null) {
            return null;
        }

        return new Response($this->render($request, $site, $page)->html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    public function resolveSite(Request $request): ?Site
    {
        return $this->siteResolver !== null
            ? ($this->siteResolver)($request)
            : Site::query()->whereNull('owner_type')->oldest('id')->first();
    }

    /** @return Catalog */
    public function catalog(): array
    {
        return [
            'elements' => array_values(array_map(fn (Element $element): array => $element->toArray(), $this->elements)),
            'actions' => array_values(array_column($this->actions, 'spec')),
            ...($this->siteFields === [] ? [] : ['siteFields' => array_map(fn (Field $field): array => $field->toArray(), $this->siteFields)]),
        ];
    }

    /** The full public page, the way a visitor gets it. */
    public function render(Request $request, Site $site, Page $page): RenderedPage
    {
        $catalog = $this->catalog();
        $settings = $site->settings();
        $head = $this->head !== null ? ($this->head)($site) : null;

        return Renderer::renderPage(
            document: ParsedDocument::parse($page->published, $catalog),
            catalog: $catalog,
            site: $settings,
            page: new PageInfo((string) $page->published_slug, $page->published_seo ?? [], $request->url()),
            base: $this->base(),
            mode: RenderMode::Public,
            host: new PageHost(
                lienzo: $this,
                site: $site,
                assets: Asset::referencedBy($site, [$page->published, $settings->favicon, $settings->ogImage]),
                url: fn (Asset $asset, bool $thumb): string => route('lienzo.media', ['lienzoAsset' => $asset, 'size' => $thumb ? 'thumb' : null]),
                form: new SessionForm($request, route('lienzo.submit')),
                head: $head === null ? null : new TrustedHtml($head->toHtml()),
                nonce: Vite::cspNonce(),
            ),
            messages: $this->messages,
        );
    }

    /**
     * An app element's markup, from its validated props: unset fields get
     * their default and image fields their URL. The public page and the
     * editor's previews both come through here.
     *
     * @param  array{type: string, props: array<string, mixed>}  $element
     * @param  Closure(string): ?string  $image  turns a stored image (`media:<id>` or a URL) into a URL
     */
    public function renderElement(array $element, Site $site, Closure $image): TrustedHtml
    {
        $definition = $this->elements[$element['type']] ?? throw new LogicException("Element type [{$element['type']}] is not registered.");
        $props = [];

        foreach ($definition->fields() as $field) {
            $value = $element['props'][$field->key] ?? null;
            $props[$field->key] = match (true) {
                $value === null => $field->defaultValue(),
                $field->kind === 'image' => $image($value),
                default => $value,
            };
        }

        return new TrustedHtml($definition->render($props, $site)->toHtml());
    }

    /**
     * Href for an app action, or null when it is not registered or goes nowhere.
     *
     * @param  array{type: string, value?: ?string}  $action
     */
    public function actionHref(array $action, Site $site): ?string
    {
        $registered = $this->actions[$action['type']] ?? null;

        return $registered === null ? null : ($registered['href'])($action['value'] ?? null, $site);
    }

    public function publicUrl(Site $site): ?string
    {
        if ($this->publicUrl !== null) {
            return ($this->publicUrl)($site);
        }

        try {
            return Route::has('lienzo.page') ? route('lienzo.page') : null;
        } catch (UrlGenerationException) {
            return null;
        }
    }

    /** A public page string in a locale, the app's over the shipped one. */
    public function message(string $key, string $locale): string
    {
        return Messages::for($locale, $this->messages)[$key];
    }

    /**
     * Path prefix of the public pages, '' at the root: what `Route::lienzo()`
     * was given, read back from the route so cached routes keep it.
     */
    private function base(): string
    {
        $uri = Route::getRoutes()->getByName('lienzo.page')?->uri() ?? '{slug?}';
        $prefix = trim(substr($uri, 0, -strlen('{slug?}')), '/');

        return $prefix === '' ? '' : "/{$prefix}";
    }
}
