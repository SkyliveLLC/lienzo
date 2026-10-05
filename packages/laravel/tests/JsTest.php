<?php

declare(strict_types=1);

use Skylive\Lienzo\Support\Js;

it('spells JSON like JSON.stringify', function (mixed $value, string $expected): void {
    expect(Js::stringify($value))->toBe($expected);
})->with([
    [-0.0, '0'],
    [0.00001, '0.00001'],
    [1e-7, '1e-7'],
    [-1.5e-7, '-1.5e-7'],
    [1e21, '1e+21'],
    [INF, 'null'],
    [9007199254740993, '9007199254740992'],
    [['a' => [1, 2.5, ['x' => null]], 'b' => "é\"/\u{2028}", 'c' => true], "{\"a\":[1,2.5,{\"x\":null}],\"b\":\"é\\\"/\u{2028}\",\"c\":true}"],
]);

it('trims what JavaScript trims, and nothing else', function (): void {
    expect(Js::trim("\u{FEFF}\u{A0}\t a \u{3000}\u{2028}"))->toBe('a')
        ->and(Js::trim("\u{85}a\u{200B}\0"))->toBe("\u{85}a\u{200B}\0");
});
