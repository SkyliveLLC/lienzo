<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

/** Live form state for a public render (core's `FormHost`). */
interface FormHost
{
    /** Where every form on the page posts. */
    public function action(): string;

    /** @return array{name: string, value: string}|null */
    public function csrf(): ?array;

    /** Previously submitted value, by `fields.<id>` (also `source`). */
    public function old(string $key): ?string;

    /** Validation message, by `fields.<id>`. */
    public function error(string $key): ?string;

    /** Confirmation shown after a successful submission. */
    public function notice(): ?string;
}
