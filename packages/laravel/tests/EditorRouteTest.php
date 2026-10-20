<?php

declare(strict_types=1);

use Skylive\Lienzo\Http\EditorRoute;

it('answers every request core\'s protocol defines, and the two image routes', function (): void {
    preg_match_all("/^\s+'([A-Z]+ \/[^']*)':/m", (string) file_get_contents(dirname(__DIR__, 2).'/core/src/protocol.ts'), $protocol);
    $routes = array_map(fn (EditorRoute $route): string => $route->value, EditorRoute::cases());

    expect($routes)->toEqualCanonicalizing([...$protocol[1], 'GET /media/:id', 'GET /media/:id/thumb']);
});
