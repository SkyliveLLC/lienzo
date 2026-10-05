<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Models;

/**
 * Lienzo tables live on `lienzo.connection` when it is set, so a
 * multi-database app (tenancy) keeps them on its central database.
 */
trait UsesLienzoConnection
{
    public function getConnectionName(): ?string
    {
        return config('lienzo.connection') ?? parent::getConnectionName();
    }
}
