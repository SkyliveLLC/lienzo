<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Closure;
use Skylive\Lienzo\Render\FormHost;
use Skylive\Lienzo\Render\MediaFile;

/** What an element renderer may ask of the page being rendered. */
final readonly class ElementContext
{
    /**
     * @param  array<string, string>  $t  page messages for the site locale
     * @param  Closure(?string): ?MediaFile  $media
     * @param  Closure(?array<string, mixed>): ?array<string, string|true>  $action
     * @param  ?FormHost  $form  submitted values and errors, when this canvas is a live form
     */
    public function __construct(
        public array $t,
        private Closure $media,
        private Closure $action,
        public ?FormHost $form,
    ) {}

    /** A `media:<id>` reference resolved by the host, or an https URL as-is. Null when nothing resolves. */
    public function media(?string $src): ?MediaFile
    {
        return ($this->media)($src);
    }

    /**
     * Link attributes for an action, or null when it goes nowhere.
     *
     * @param  array<string, mixed>|null  $action
     * @return array<string, string|true>|null
     */
    public function action(?array $action): ?array
    {
        return ($this->action)($action);
    }
}
