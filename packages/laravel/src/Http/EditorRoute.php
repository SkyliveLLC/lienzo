<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http;

use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * @internal
 *
 * Every request of the editor protocol, keyed the way
 * `@skylivellc/lienzo-core/protocol` keys them, plus the editor's own image
 * URLs, which the protocol leaves to the backend. Paths are relative to the
 * endpoint the editor was given, and each `:name` is a positive integer.
 */
enum EditorRoute: string
{
    case Workspace = 'GET /';
    case UpdateSite = 'PUT /site';
    case StorePage = 'POST /pages';
    case ShowPage = 'GET /pages/:id';
    case UpdatePage = 'PUT /pages/:id';
    case DestroyPage = 'DELETE /pages/:id';
    case Publish = 'POST /pages/:id/publish';
    case Restore = 'POST /pages/:id/versions/:version/restore';
    case StoreAsset = 'POST /assets';
    case DestroyAsset = 'DELETE /assets/:id';
    case Media = 'GET /media/:id';
    case Thumb = 'GET /media/:id/thumb';
    case Preview = 'POST /preview';
    case Submissions = 'GET /submissions';

    /**
     * The route a request is for, with its `:name` segments in order. HEAD
     * counts as GET.
     *
     * @param  string  $path  below the endpoint, without slashes around it: '', 'pages/3', 'media/7/thumb'
     * @return array{self, list<int>}
     *
     * @throws NotFoundHttpException when no route has this path
     * @throws MethodNotAllowedHttpException when routes have this path, but not this method
     */
    public static function match(string $method, string $path): array
    {
        $method = $method === 'HEAD' ? 'GET' : $method;
        $allowed = [];

        foreach (self::cases() as $route) {
            [$verb, $template] = explode(' ', $route->value);

            // Eighteen digits at most, so every id fits an int.
            if (preg_match('#^'.preg_replace('/:\w+/', '([1-9][0-9]{0,17})', $template).'$#', "/{$path}", $ids) !== 1) {
                continue;
            }

            if ($verb === $method) {
                return [$route, array_map(intval(...), array_slice($ids, 1))];
            }

            $allowed[] = $verb;
        }

        throw $allowed === [] ? new NotFoundHttpException : new MethodNotAllowedHttpException($allowed);
    }
}
