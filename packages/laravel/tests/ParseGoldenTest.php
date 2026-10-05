<?php

declare(strict_types=1);

use Skylive\Lienzo\Document\DocumentError;
use Skylive\Lienzo\Document\Issue;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Document\ParsedSiteSettings;
use Skylive\Lienzo\Render\Canvas;
use Skylive\Lienzo\Tests\Fixtures;

/** The golden's `{ok: ..., ...extra}` or `{issues: ['path:code', ...]}` for one parse. */
function parseOutcome(Closure $parse, ?Closure $extra = null): array
{
    try {
        $value = $parse();

        return ['ok' => $value->toArray(), ...($extra === null ? [] : $extra($value))];
    } catch (DocumentError $error) {
        return ['issues' => array_map(fn (Issue $issue): string => "{$issue->path}:{$issue->code->value}", $error->issues)];
    }
}

dataset('parse goldens', function (): array {
    $names = array_map(fn (string $file): string => basename($file, '.json'), glob(Fixtures::path('parse/*.json')) ?: []);

    return array_combine($names, array_map(fn (string $name): array => [$name], $names));
});

it('parses like core', function (string $name): void {
    $input = is_file(Fixtures::path("parse/inputs/{$name}.json"))
        ? Fixtures::json("parse/inputs/{$name}.json")
        : Fixtures::json("render/{$name}.json");
    $golden = Fixtures::json("parse/{$name}.json");
    $actual = [];

    if (array_key_exists('document', $input)) {
        $actual['document'] = parseOutcome(
            fn (): ParsedDocument => ParsedDocument::parse($input['document'], Fixtures::catalog()),
            fn (ParsedDocument $document): array => ['forms' => Canvas::formFields($document)],
        );
    }

    if (array_key_exists('site', $input)) {
        $actual['site'] = parseOutcome(fn (): ParsedSiteSettings => ParsedSiteSettings::parse($input['site']));
    }

    expect(Fixtures::encode($actual))->toBe(Fixtures::encode($golden));
})->with('parse goldens');
