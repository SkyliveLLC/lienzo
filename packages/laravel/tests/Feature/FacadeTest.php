<?php

declare(strict_types=1);

use Skylive\Lienzo\Facades\Lienzo;
use Skylive\Lienzo\LienzoManager;

it('documents every public method of the manager on the facade, for editors and static analysis', function (): void {
    $methods = array_map(fn (ReflectionMethod $method): string => $method->getName(), (new ReflectionClass(LienzoManager::class))->getMethods(ReflectionMethod::IS_PUBLIC));
    preg_match_all('/@method static .+? (\w+)\(/', (string) (new ReflectionClass(Lienzo::class))->getDocComment(), $documented);

    expect(array_values(array_diff($methods, ['__construct'], $documented[1])))->toBe([]);
});
