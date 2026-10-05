<?php

declare(strict_types=1);

use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Render\Elements\CoreElements;
use Skylive\Lienzo\Render\Html;

it('formats numbers like core', function (int|float $value, string $expected): void {
    expect(Html::num($value))->toBe($expected);
})->with([
    [26.666666666666668, '26.667'],
    [1.0005, '1.001'],
    [-1.0005, '-1.001'],
    [0.0005, '0.001'],
    [-0.0004, '0'],
    [1e-7, '0'],
    [2.5, '2.5'],
    [1234, '1234'],
    [9.9995, '10'],
    [1e21, '1000000000000000000000'],
]);

it('escapes like core', function (): void {
    expect(Html::escape('<a href="x">Tom & \'Jerry\'</a>'))->toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#039;Jerry&#039;&lt;/a&gt;');
});

it('sorts attributes and refuses unsafe URLs', function (): void {
    expect(Html::h('a', ['target' => '_blank', 'href' => 'https://x.test', 'class' => 'b'])->html)->toBe('<a class="b" href="https://x.test" target="_blank"></a>')
        ->and(fn () => Html::h('a', ['href' => 'javascript:alert(1)']))->toThrow(LogicException::class)
        ->and(fn () => Html::h('img', ['src' => 'data:image/png;base64,x']))->toThrow(LogicException::class)
        ->and(fn () => Html::h('a', ['href' => "\n"]))->toThrow(LogicException::class);
});

it('has a renderer for every core element type', function (): void {
    expect(array_keys(CoreElements::RENDERERS))->toEqualCanonicalizing(Assets::data()['elementTypes']);
});
