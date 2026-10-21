<?php

declare(strict_types=1);

use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\LienzoManager;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Tests\App\NewsElement;

it('documents every public method of the manager on the facade, for editors and static analysis', function (): void {
    $methods = array_map(fn (ReflectionMethod $method): string => $method->getName(), (new ReflectionClass(LienzoManager::class))->getMethods(ReflectionMethod::IS_PUBLIC));
    preg_match_all('/@method static .+? (\w+)\(/', (string) (new ReflectionClass(Lienzo::class))->getDocComment(), $documented);

    expect(array_values(array_diff($methods, ['__construct'], $documented[1])))->toBe([]);
});

it('hands back the elements the app registered, so an admin can tell where each came from', function (): void {
    Lienzo::element(NewsElement::class);

    expect(Lienzo::elements())->toHaveKey('news')
        ->and(Lienzo::elements()['news'])->toBeInstanceOf(NewsElement::class);
});

it('lets the app decide which elements a site may use', function (): void {
    Lienzo::element(NewsElement::class);
    $seen = [];

    Lienzo::elementsFor(function (array $elements, ?Site $site) use (&$seen): array {
        $seen[] = $site?->id;

        return $site === null ? $elements : [];
    });

    expect(Lienzo::catalog()['elements'])->toHaveCount(1)
        ->and(Lienzo::catalog(Site::create(['name' => 'Acme']))['elements'])->toBe([])
        ->and($seen)->toHaveCount(2);
});
