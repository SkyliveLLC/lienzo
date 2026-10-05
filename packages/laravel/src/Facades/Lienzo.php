<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Facades;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Facade;
use Skylive\Lienzo\Element;
use Skylive\Lienzo\Field;
use Skylive\Lienzo\LienzoManager;
use Skylive\Lienzo\Models\Page;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Render\RenderedPage;
use Skylive\Lienzo\Render\TrustedHtml;

/**
 * @method static void resolveSiteUsing(Closure $resolver)
 * @method static void element(class-string<Element>|Element $element)
 * @method static void action(string $type, string|array<string, string> $label, Closure $href, ?Field $value = null)
 * @method static void siteFields(Field ...$fields)
 * @method static void head(Closure $head)
 * @method static void messages(string $locale, array<string, string> $messages)
 * @method static void publicUrlUsing(Closure $url)
 * @method static Response|null page(Request $request, ?string $slug = null)
 * @method static Site|null resolveSite(Request $request)
 * @method static string editorScriptUrl()
 * @method static string|null publicUrl(Site $site)
 * @method static string message(string $key, string $locale)
 * @method static array<string, mixed> catalog()
 * @method static RenderedPage render(Request $request, Site $site, Page $page)
 * @method static TrustedHtml renderElement(array{type: string, props: array<string, mixed>} $element, Site $site, Closure $image)
 * @method static string|null actionHref(array{type: string, value?: ?string} $action, Site $site)
 *
 * @see LienzoManager
 */
final class Lienzo extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return LienzoManager::class;
    }
}
