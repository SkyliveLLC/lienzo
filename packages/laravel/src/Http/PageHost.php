<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http;

use Closure;
use Illuminate\Support\Collection;
use Skylive\Lienzo\LienzoManager;
use Skylive\Lienzo\Models\Asset;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Render\FormHost;
use Skylive\Lienzo\Render\MediaFile;
use Skylive\Lienzo\Render\RenderHost;
use Skylive\Lienzo\Render\TrustedHtml;

/**
 * The renderer's holes, answered by the app: uploaded images, app actions
 * and app elements, the form state and the head hook. The public page and
 * the editor's previews differ only in the media URLs and the form.
 */
final readonly class PageHost implements RenderHost
{
    /**
     * @param  Collection<int, Asset>  $assets  the site's assets the page mentions, by id
     * @param  Closure(Asset, bool $thumb): string  $url
     */
    public function __construct(
        private LienzoManager $lienzo,
        private Site $site,
        private Collection $assets,
        private Closure $url,
        private ?FormHost $form = null,
        private ?TrustedHtml $head = null,
        private ?string $nonce = null,
    ) {}

    public function media(string $ref): ?MediaFile
    {
        $asset = $this->assets->get((int) substr($ref, strlen('media:')));

        return $asset === null ? null : new MediaFile(
            ($this->url)($asset, false),
            $asset->thumb_path === null ? null : ($this->url)($asset, true),
            $asset->width,
            $asset->height,
        );
    }

    public function action(array $action): ?string
    {
        return $this->lienzo->actionHref($action, $this->site);
    }

    public function appElement(array $element): TrustedHtml
    {
        return $this->lienzo->renderElement($element, $this->site, $this->image(...));
    }

    public function form(): ?FormHost
    {
        return $this->form;
    }

    public function head(): ?TrustedHtml
    {
        return $this->head;
    }

    public function nonce(): ?string
    {
        return $this->nonce;
    }

    /** A stored image as a URL: an upload through the media route, anything else is already a URL. */
    private function image(string $src): ?string
    {
        return str_starts_with($src, 'media:') ? $this->media($src)?->url : $src;
    }
}
