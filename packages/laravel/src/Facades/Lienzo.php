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

/**
 * @method static void resolveSiteUsing(Closure $resolver)
 * @method static void element(class-string<Element>|Element $element)
 * @method static void action(string $type, string|array<string, string> $label, Closure $href, ?Field $value = null)
 * @method static void siteFields(Field ...$fields)
 * @method static void head(Closure $head)
 * @method static void messages(string $locale, array<string, string> $messages)
 * @method static void publicUrlUsing(Closure $url)
 * @method static Response|null page(Request $request, ?string $slug = null)
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
