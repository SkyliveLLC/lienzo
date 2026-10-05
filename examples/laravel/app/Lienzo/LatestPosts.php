<?php

namespace App\Lienzo;

use App\Models\Post;
use Illuminate\Contracts\Support\Htmlable;
use Skylive\Lienzo\Element;
use Skylive\Lienzo\Field;
use Skylive\Lienzo\Models\Site;

/**
 * The newest posts, read from the database on every request: publishing a
 * page stores the element's settings, never the posts themselves.
 */
class LatestPosts extends Element
{
    protected string $type = 'latest_posts';

    protected string|array $label = ['en' => 'Latest posts', 'es' => 'Últimas entradas'];

    protected string $icon = 'file-text';

    protected array $size = ['w' => 40, 'h' => 260];

    public function fields(): array
    {
        return [
            Field::text('heading', ['en' => 'Heading', 'es' => 'Título'], max: 60)->default('From the blog'),
            Field::number('count', ['en' => 'How many', 'es' => 'Cuántas'], min: 1, max: 6)->default(3),
        ];
    }

    public function render(array $props, Site $site): Htmlable
    {
        return view('elements.latest-posts', [
            'heading' => $props['heading'],
            'posts' => Post::query()->latest('id')->limit($props['count'])->get(),
        ]);
    }

    public function css(): ?string
    {
        return '.posts{display:flex;flex-direction:column;gap:.6em;height:100%}.posts h3{margin:0;font-family:var(--font-heading)}'
            .'.posts ul{margin:0;padding-left:1.2em}.posts li{margin:.2em 0}';
    }
}
