<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Document;

/** One reason a document or site settings failed to parse. `path` is dotted: `sections.0.elements.3.style.color`. */
final readonly class Issue
{
    public function __construct(
        public string $path,
        public IssueCode $code,
        public string $message,
    ) {}
}
