<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Document;

use InvalidArgumentException;

final class DocumentError extends InvalidArgumentException
{
    /** @param non-empty-list<Issue> $issues */
    public function __construct(public readonly array $issues)
    {
        $summary = array_map(fn (Issue $issue): string => "{$issue->path} {$issue->message}", array_slice($issues, 0, 3));

        parent::__construct('Invalid document: '.implode('; ', $summary));
    }
}
