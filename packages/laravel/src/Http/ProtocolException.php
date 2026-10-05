<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http;

use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;
use Skylive\Lienzo\Document\DocumentError;
use Skylive\Lienzo\Document\Issue;
use Skylive\Lienzo\Document\IssueCode;

/**
 * An editor request the protocol answers with an error body: 422
 * `{message, issues}` for invalid input, 409 `{message, revision}` for a
 * stale `baseRevision`. Laravel renders it through `render()` and, like a
 * validation error, never logs it.
 */
final class ProtocolException extends RuntimeException implements ShouldntReport
{
    /** @param array<string, mixed> $body */
    private function __construct(private readonly array $body, private readonly int $status)
    {
        parent::__construct($body['message']);
    }

    /** @param list<Issue> $issues */
    public static function invalid(array $issues, string $message = 'The given data was invalid.'): self
    {
        return new self(['message' => $message, 'issues' => array_map(fn (Issue $issue): array => [
            'path' => $issue->path,
            'code' => $issue->code->value,
            'message' => $issue->message,
        ], $issues)], 422);
    }

    public static function issue(string $path, IssueCode $code, string $message): self
    {
        return self::invalid([new Issue($path, $code, $message)], $message);
    }

    /** A parse failure of the value at `$path` (`draft`, `meta`), with issue paths made absolute. */
    public static function document(DocumentError $error, string $path = ''): self
    {
        return self::invalid(array_map(
            fn (Issue $issue): Issue => new Issue(implode('.', array_filter([$path, $issue->path], fn (string $part): bool => $part !== '')), $issue->code, $issue->message),
            $error->issues,
        ));
    }

    public static function conflict(int $revision): self
    {
        return new self(['message' => 'This page was saved somewhere else since you loaded it.', 'revision' => $revision], 409);
    }

    public function render(): JsonResponse
    {
        return new JsonResponse($this->body, $this->status);
    }
}
