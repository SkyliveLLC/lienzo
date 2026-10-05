<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests\App;

use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\HtmlString;
use Skylive\Lienzo\Element;
use Skylive\Lienzo\Field;
use Skylive\Lienzo\Models\Site;

/** Headlines from `config('news')`, read on every render: the live data an app element exists for. */
final class NewsElement extends Element
{
    protected string $type = 'news';

    protected string|array $label = ['en' => 'News', 'es' => 'Noticias'];

    protected string $icon = 'quote';

    public function fields(): array
    {
        return [
            Field::text('heading', 'Heading', max: 60)->default('Latest'),
            Field::number('limit', 'How many', min: 1, max: 5)->default(2),
            Field::choice('look', 'Look', ['cards' => 'Cards', 'list' => 'List']),
            Field::image('photo', 'Photo'),
        ];
    }

    public function render(array $props, Site $site): Htmlable
    {
        $items = array_slice(config('news', []), 0, $props['limit']);

        return new HtmlString(
            '<div class="news" data-look="'.e($props['look']).'"><h3>'.e($props['heading']).' at '.e($site->name).'</h3>'
            .($props['photo'] !== null ? '<img src="'.e($props['photo']).'" alt="">' : '')
            .implode('', array_map(fn (string $item): string => '<p>'.e($item).'</p>', $items)).'</div>'
        );
    }

    public function css(): ?string
    {
        return '.news h3{margin:0}';
    }
}
