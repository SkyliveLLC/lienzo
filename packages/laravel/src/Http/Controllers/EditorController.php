<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http\Controllers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Skylive\Lienzo\AssetLibrary;
use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Document\DocumentError;
use Skylive\Lienzo\Document\Issue;
use Skylive\Lienzo\Document\IssueCode;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Document\ParsedSiteSettings;
use Skylive\Lienzo\Document\Schema;
use Skylive\Lienzo\Http\EditorRoute;
use Skylive\Lienzo\Http\PageHost;
use Skylive\Lienzo\Http\ProtocolException;
use Skylive\Lienzo\LienzoManager;
use Skylive\Lienzo\Models\Asset;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\PageVersion;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Models\Submission;
use Skylive\Lienzo\Render\Canvas;
use Symfony\Component\HttpFoundation\Response;

/**
 * The editor protocol (`@skylivellc/lienzo-core/protocol`) for one site, as
 * JSON. Whoever routes here has already decided the user may edit the site:
 * `Route::lienzoEditor()` through the `lienzo.manage` gate, a host route
 * calling `Lienzo::editor()` through its own rules. Every page, version and
 * image id is looked up through that site.
 *
 * Bodies are decoded from the raw request, because the app's TrimStrings
 * and ConvertEmptyStringsToNull middleware would rewrite page text.
 *
 * PHP cannot tell an empty JSON object from an empty list, so stored
 * documents come back with `[]` for an empty object; core's parse reads both.
 */
final class EditorController
{
    /** Slugs are lowercase words joined by dashes; the home page's is empty. */
    private const array SLUG = ['present', 'string', 'max:120', 'regex:/^([a-z0-9]+(-[a-z0-9]+)*)?$/'];

    public function __construct(private readonly LienzoManager $lienzo, private readonly AssetLibrary $library) {}

    /** The route `Route::lienzoEditor()` registers, `{lienzoSite}/{lienzoPath?}`, behind the gate. */
    public function __invoke(Request $request): Response
    {
        return $this->respond($request, $request->route('lienzoSite'), (string) $request->route('lienzoPath'));
    }

    /**
     * Answers one protocol request for `$site`. `$path` is the URL below the
     * editor's endpoint: '' for the workspace, 'pages/3', 'media/7/thumb'.
     */
    public function respond(Request $request, Site $site, string $path): Response
    {
        $path = trim($path, '/');
        [$route, $ids] = EditorRoute::match($request->getMethod(), $path);
        $endpoint = self::endpoint($request, $path);

        // No default arm: a case without a handler throws UnhandledMatchError.
        return match ($route) {
            EditorRoute::Workspace => new JsonResponse($this->workspaceOf($site, $endpoint)),
            EditorRoute::UpdateSite => $this->updateSite($request, $site, $endpoint),
            EditorRoute::StorePage => $this->storePage($request, $site),
            EditorRoute::ShowPage => $this->showPage($site, ...$ids),
            EditorRoute::UpdatePage => $this->updatePage($request, $site, ...$ids),
            EditorRoute::DestroyPage => $this->destroyPage($site, ...$ids),
            EditorRoute::Publish => $this->publish($request, $site, ...$ids),
            EditorRoute::Restore => $this->restore($site, ...$ids),
            EditorRoute::StoreAsset => $this->storeAsset($request, $site, $endpoint),
            EditorRoute::DestroyAsset => $this->destroyAsset($site, ...$ids),
            EditorRoute::Media => $this->library->response($site->assets()->findOrFail($ids[0]), thumb: false, public: false),
            EditorRoute::Thumb => $this->library->response($site->assets()->findOrFail($ids[0]), thumb: true, public: false),
            EditorRoute::Preview => $this->preview($request, $site, $endpoint),
            EditorRoute::Submissions => $this->submissions($site),
        };
    }

    private function updateSite(Request $request, Site $site, string $endpoint): JsonResponse
    {
        $body = $this->body($request);
        $current = $site->settings()->toArray();
        $theme = $body['theme'] ?? [];

        try {
            $settings = ParsedSiteSettings::parse([
                ...$current,
                ...array_intersect_key($body, array_flip(['seo', 'locale', 'favicon', 'og_image'])),
                'theme' => is_array($theme) ? [...$current['theme'], ...$theme] : $theme,
            ]);
            $meta = array_key_exists('meta', $body)
                ? Schema::check(ParsedDocument::fieldsSchema($this->lienzo->catalog($site)['siteFields'] ?? []), $body['meta'], ['meta'])
                : [];
        } catch (DocumentError $error) {
            throw ProtocolException::document($error);
        }

        $site->update([
            'locale' => $settings->locale,
            'theme' => $settings->theme,
            'seo' => $settings->seo,
            'favicon' => $settings->favicon,
            'og_image' => $settings->ogImage,
            'meta' => [...$site->meta ?? [], ...$meta],
        ]);

        return new JsonResponse($this->workspaceOf($site, $endpoint));
    }

    private function showPage(Site $site, int $id): JsonResponse
    {
        return new JsonResponse($this->state($site->pages()->findOrFail($id)));
    }

    private function storePage(Request $request, Site $site): JsonResponse
    {
        $body = $this->body($request);
        $this->validate($body, ['title' => ['required', 'string', 'max:120'], 'slug' => self::SLUG]);
        $this->assertFreeSlug($site, $body['slug']);

        $draft = array_key_exists('draft', $body) ? $this->document($body['draft'], 'draft', $site) : Page::BLANK;
        $page = self::claimingSlug(fn (): Page => $site->pages()->create(['title' => $body['title'], 'slug' => $body['slug'], 'draft' => $draft]));

        return new JsonResponse($this->state($page), 201);
    }

    private function updatePage(Request $request, Site $site, int $id): JsonResponse
    {
        $page = $site->pages()->findOrFail($id);
        $body = $this->body($request);
        $this->validate($body, [
            'baseRevision' => ['required', 'integer'],
            'title' => ['sometimes', 'required', 'string', 'max:120'],
            'slug' => ['sometimes', ...self::SLUG],
        ]);

        if (array_key_exists('slug', $body)) {
            $this->assertFreeSlug($site, $body['slug'], $page);
        }

        $changes = array_intersect_key($body, array_flip(['title', 'slug']));

        if (array_key_exists('seo', $body)) {
            $changes['seo'] = $this->seo($body['seo']);
        }

        if (array_key_exists('draft', $body)) {
            $changes['draft'] = $this->document($body['draft'], 'draft', $site);
        }

        $page = $this->writeAt($page, (int) $body['baseRevision'], function (Page $page) use ($changes): void {
            $page->fill($changes);
            $page->revision++;
        });

        return new JsonResponse(['revision' => $page->revision]);
    }

    private function destroyPage(Site $site, int $id): JsonResponse
    {
        $site->pages()->findOrFail($id)->delete();

        return self::nothing();
    }

    /**
     * Publishes the draft, slug and SEO at the given revision; until then
     * the public page keeps its old address and tags. Publishing what is
     * already published changes nothing, and only a changed document is a
     * new version, so a retried request creates none.
     */
    private function publish(Request $request, Site $site, int $id): JsonResponse
    {
        $page = $site->pages()->findOrFail($id);
        $body = $this->body($request);
        $this->validate($body, ['revision' => ['required', 'integer']]);
        $user = $request->user();

        $page = $this->writeAt($page, (int) $body['revision'], function (Page $page) use ($user, $site): void {
            $live = ['published' => $page->published, 'published_slug' => $page->published_slug, 'published_seo' => $page->published_seo ?? []];
            $next = ['published' => $this->document($page->draft, 'draft', $site), 'published_slug' => $page->slug, 'published_seo' => $page->seo ?? []];

            if ($page->published !== null && json_encode($next) === json_encode($live)) {
                return;
            }

            $page->fill([...$next, 'published_at' => now()]);
            $page->publishedBy()->associate($user instanceof Model ? $user : null);

            if (json_encode($next['published']) === json_encode($live['published'])) {
                return;
            }

            $version = new PageVersion(['document' => $next['published']]);
            $version->createdBy()->associate($user instanceof Model ? $user : null);
            $page->versions()->save($version);

            $page->versions()->whereKeyNot(
                $page->versions()->latest('id')->limit(config('lienzo.versions'))->pluck('id')
            )->delete();
        });

        return new JsonResponse($this->state($page));
    }

    /** Copies a published version back into the draft, as a new revision. */
    private function restore(Site $site, int $id, int $versionId): JsonResponse
    {
        $page = $site->pages()->findOrFail($id);
        $version = $page->versions()->findOrFail($versionId);

        $page = $this->writeAt($page, null, function (Page $page) use ($version): void {
            $page->draft = $version->document;
            $page->revision++;
        });

        return new JsonResponse($this->state($page));
    }

    private function storeAsset(Request $request, Site $site, string $endpoint): JsonResponse
    {
        $this->validate($request->all(), ['file' => [
            'required', 'file', 'max:'.config('lienzo.upload_max_kb'), 'mimes:jpg,jpeg,png,webp,avif,svg',
        ]]);

        return new JsonResponse(self::asset($endpoint, $this->library->store($site, $request->file('file'))), 201);
    }

    private function destroyAsset(Site $site, int $id): JsonResponse
    {
        $this->library->delete($site->assets()->findOrFail($id));

        return self::nothing();
    }

    /** App element markup for the canvas, rendered the way the public page renders it. */
    private function preview(Request $request, Site $site, string $endpoint): JsonResponse
    {
        $body = $this->body($request);
        $this->validate($body, [
            'elements' => ['present', 'array', 'max:200'],
            'elements.*.id' => ['required', 'string', 'max:40'],
            'elements.*.type' => ['required', 'string', 'max:40'],
            'elements.*.props' => ['present', 'array'],
        ]);

        $specs = array_column($this->lienzo->catalog($site)['elements'], 'fields', 'type');
        $host = $this->host($site, $endpoint, $body['elements']);
        $html = [];
        $issues = [];

        foreach ($body['elements'] as $index => $element) {
            if (! isset($specs[$element['type']])) {
                continue;
            }

            try {
                $props = Schema::check(ParsedDocument::fieldsSchema($specs[$element['type']]), $element['props'], ['elements', $index, 'props']);
                $html[$element['id']] = $host->appElement(['type' => $element['type'], 'props' => $props])->html;
            } catch (DocumentError $error) {
                array_push($issues, ...$error->issues);
            }
        }

        if ($issues !== []) {
            throw ProtocolException::invalid($issues);
        }

        return new JsonResponse((object) $html);
    }

    private function submissions(Site $site): JsonResponse
    {
        $page = $site->submissions()->latest('id')->cursorPaginate(20);

        return new JsonResponse([
            'data' => array_map(fn (Submission $submission): array => [
                'id' => $submission->id,
                'page' => $submission->page,
                'source' => $submission->source,
                'fields' => (object) self::answers($submission->fields),
                'createdAt' => $submission->created_at?->toIso8601String(),
            ], $page->items()),
            'next' => $page->nextCursor()?->encode(),
        ]);
    }

    /**
     * The URL the editor was given: this request's, without the protocol
     * path. Image URLs hang off it, so they work wherever the protocol is
     * mounted, inside any group parameters the host has (a `{tenant}`).
     */
    private static function endpoint(Request $request, string $path): string
    {
        return url(Str::chopEnd(rtrim($request->getPathInfo(), '/'), "/{$path}"));
    }

    /** What EditorRoute::Media and EditorRoute::Thumb answer for this image. */
    private static function mediaUrl(string $endpoint, Asset $asset, bool $thumb): string
    {
        return "{$endpoint}/media/{$asset->id}".($thumb ? '/thumb' : '');
    }

    /** @return array<string, mixed> */
    private function workspaceOf(Site $site, string $endpoint): array
    {
        $settings = $site->settings()->toArray();

        return [
            'site' => [...$settings, 'seo' => (object) $settings['seo']],
            'meta' => (object) ($site->meta ?? []),
            'publicUrl' => $this->lienzo->publicUrl($site),
            'pages' => $site->pages()->orderBy('slug')->get()->map($this->summary(...))->all(),
            'catalog' => $this->lienzo->catalog($site),
            'assets' => $site->assets()->latest('id')->get()->map(fn (Asset $asset): array => self::asset($endpoint, $asset))->all(),
            'quota' => $this->library->quota($site),
        ];
    }

    /** @return array{id: int, slug: string, title: string, publishedAt: ?string} */
    private function summary(Page $page): array
    {
        return ['id' => $page->id, 'slug' => $page->slug, 'title' => $page->title, 'publishedAt' => $page->published_at?->toIso8601String()];
    }

    /** @return array<string, mixed> */
    private function state(Page $page): array
    {
        return [
            ...$this->summary($page),
            'seo' => (object) ($page->seo ?? []),
            'draft' => $page->draft,
            'revision' => $page->revision,
            'versions' => $page->versions()->with('createdBy')->latest('id')->limit(20)->get()
                ->map(fn (PageVersion $version): array => [
                    'id' => $version->id,
                    'createdAt' => $version->created_at?->toIso8601String(),
                    'by' => self::name($version->createdBy),
                ])->all(),
        ];
    }

    /** @return array{id: int, ref: string, name: string, url: string, thumb: string, width: ?int, height: ?int} */
    private static function asset(string $endpoint, Asset $asset): array
    {
        return [
            'id' => $asset->id,
            'ref' => $asset->ref(),
            'name' => $asset->name,
            'url' => self::mediaUrl($endpoint, $asset, thumb: false),
            'thumb' => self::mediaUrl($endpoint, $asset, thumb: $asset->thumb_path !== null),
            'width' => $asset->width,
            'height' => $asset->height,
        ];
    }

    /** @param array<int, mixed> $elements */
    private function host(Site $site, string $endpoint, array $elements): PageHost
    {
        return new PageHost(
            lienzo: $this->lienzo,
            site: $site,
            assets: Asset::referencedBy($site, $elements),
            url: fn (Asset $asset, bool $thumb): string => self::mediaUrl($endpoint, $asset, $thumb),
        );
    }

    /**
     * Applies `$change` to the locked row, failing with 409 when its revision
     * is not `$revision` (null skips the check).
     *
     * @param  \Closure(Page): void  $change
     */
    private function writeAt(Page $page, ?int $revision, \Closure $change): Page
    {
        return self::claimingSlug(fn (): Page => $page->getConnection()->transaction(function () use ($page, $revision, $change): Page {
            $locked = Page::query()->lockForUpdate()->findOrFail($page->id);

            if ($revision !== null && $locked->revision !== $revision) {
                throw ProtocolException::conflict($locked->revision);
            }

            $change($locked);
            $locked->save();

            return $locked;
        }));
    }

    /**
     * Runs a write that may take a slug. `assertFreeSlug` answers the usual
     * case; this answers two requests racing for the same address.
     *
     * @param  \Closure(): Page  $write
     */
    private static function claimingSlug(\Closure $write): Page
    {
        try {
            return $write();
        } catch (UniqueConstraintViolationException) {
            throw ProtocolException::issue('slug', IssueCode::Unique, 'Another page already uses this address.');
        }
    }

    /** @return array<string, mixed> */
    private function document(mixed $input, string $path, ?Site $site = null): array
    {
        try {
            $document = ParsedDocument::parse($input, $this->lienzo->catalog($site));
        } catch (DocumentError $error) {
            throw ProtocolException::document($error, $path);
        }

        // A submission names its form by this id, so two forms sharing one could take each other's fields.
        $sources = array_column(Canvas::formFields($document), 'source');
        $shared = array_diff_assoc($sources, array_unique($sources));

        if ($shared !== []) {
            throw ProtocolException::issue($path, IssueCode::Unique, 'Two forms use the id "'.reset($shared).'". Rename a section, group or modal.');
        }

        return $document->toArray();
    }

    /** @return array{title?: ?string, description?: ?string} */
    private function seo(mixed $input): array
    {
        try {
            // The page SEO object has the same shape as the site's.
            return Schema::check(Assets::schema()['$defs']['SiteSettings']['properties']['seo'], $input, ['seo']) ?? [];
        } catch (DocumentError $error) {
            throw ProtocolException::document($error);
        }
    }

    /** A slug is taken by another page's draft, or by its live address until that page publishes a new one. */
    private function assertFreeSlug(Site $site, string $slug, ?Page $except = null): void
    {
        $taken = $site->pages()
            ->where(fn ($query) => $query->where('slug', $slug)->orWhere('published_slug', $slug))
            ->when($except, fn ($query) => $query->whereKeyNot($except->id))
            ->exists();

        if ($taken) {
            throw ProtocolException::issue('slug', IssueCode::Unique, 'Another page already uses this address.');
        }
    }

    /** @return array<string, mixed> */
    private function body(Request $request): array
    {
        $body = json_decode($request->getContent() ?: '{}', true);

        if (! is_array($body) || ($body !== [] && array_is_list($body))) {
            throw ProtocolException::issue('', IssueCode::Type, 'The body must be a JSON object.');
        }

        return $body;
    }

    /**
     * Runs Laravel validation and reports failures as protocol issues.
     *
     * @param  array<string, mixed>  $data
     * @param  array<string, list<mixed>>  $rules
     */
    private function validate(array $data, array $rules): void
    {
        $validator = Validator::make($data, $rules);

        if ($validator->passes()) {
            return;
        }

        $issues = [];

        foreach ($validator->failed() as $path => $failed) {
            $issues[] = new Issue($path, self::code(array_key_first($failed)), $validator->errors()->first($path));
        }

        throw ProtocolException::invalid($issues, $issues[0]->message);
    }

    private static function code(string $rule): IssueCode
    {
        return match ($rule) {
            'Required', 'Present' => IssueCode::Required,
            'Max', 'Min', 'Between', 'Size' => IssueCode::Size,
            'Regex' => IssueCode::Pattern,
            'In', 'Mimes', 'Mimetypes' => IssueCode::Enum,
            default => IssueCode::Type,
        };
    }

    /**
     * A submission's answers by label, for reading. Two fields with the same label stay apart.
     *
     * @param  list<array{name: string, label: string, value: string|bool}>  $fields
     * @return array<string, string|bool>
     */
    private static function answers(array $fields): array
    {
        $answers = [];

        foreach ($fields as $field) {
            $label = $field['label'] !== '' ? $field['label'] : $field['name'];
            $key = $label;

            for ($n = 2; array_key_exists($key, $answers); $n++) {
                $key = "{$label} ({$n})";
            }

            $answers[$key] = $field['value'];
        }

        return $answers;
    }

    /** The protocol's `null` body (a bare JsonResponse would send `{}`). */
    private static function nothing(): JsonResponse
    {
        return new JsonResponse('null', json: true);
    }

    private static function name(?Model $user): ?string
    {
        $name = $user?->getAttribute('name');

        return is_string($name) ? $name : null;
    }
}
