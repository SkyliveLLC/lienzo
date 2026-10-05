<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests;

use Skylive\Lienzo\Render\FormHost;

/** A render fixture's form state. */
final readonly class FixtureForm implements FormHost
{
    /** @param array{action: string, csrf: ?array{name: string, value: string}, old: array<string, string>, errors: array<string, string>, notice: ?string} $form */
    public function __construct(private array $form) {}

    public function action(): string
    {
        return $this->form['action'];
    }

    public function csrf(): ?array
    {
        return $this->form['csrf'];
    }

    public function old(string $key): ?string
    {
        return $this->form['old'][$key] ?? null;
    }

    public function error(string $key): ?string
    {
        return $this->form['errors'][$key] ?? null;
    }

    public function notice(): ?string
    {
        return $this->form['notice'];
    }
}
