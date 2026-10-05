<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

enum RenderMode: string
{
    case Public = 'public';
    /** Drops entrance animations and the runtime, and shows a placeholder for unregistered element types. */
    case Edit = 'edit';
}
