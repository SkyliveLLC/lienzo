<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

/** The renderer for each core element type. */
final class CoreElements
{
    /** @var array<string, class-string<ElementRenderer>> */
    public const array RENDERERS = [
        'heading' => Heading::class,
        'text' => Text::class,
        'image' => Image::class,
        'button' => Button::class,
        'divider' => Divider::class,
        'video' => Video::class,
        'shape' => Shape::class,
        'icon' => Icon::class,
        'navbar' => Navbar::class,
        'input' => Input::class,
        'textarea' => Textarea::class,
        'select' => Select::class,
        'checkbox' => Checkbox::class,
    ];
}
