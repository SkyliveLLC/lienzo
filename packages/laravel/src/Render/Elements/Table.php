<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render\Elements;

use Skylive\Lienzo\Render\Html;
use Skylive\Lienzo\Render\TrustedHtml;

/**
 * A table of plain cells: prices, hours, whatever comes in rows. With
 * `header` on, the first row names the columns and the browser treats it as
 * such, which is what a screen reader reads back.
 */
final class Table implements ElementRenderer
{
    public static function render(array $element, ElementContext $context): ElementNode
    {
        $rows = $element['props']['rows'] ?? [];
        $header = ($element['props']['header'] ?? null) !== false && $rows !== [];
        $body = [];

        foreach (array_slice($rows, $header ? 1 : 0) as $row) {
            $body[] = Html::h('tr', [], self::cells($row, 'td'));
        }

        return new ElementNode('table', 'lz-table', [], [
            $header && isset($rows[0]) ? Html::h('thead', [], [Html::h('tr', [], self::cells($rows[0], 'th'))]) : null,
            Html::h('tbody', [], $body),
        ]);
    }

    /**
     * @param  list<string>  $row
     * @return list<TrustedHtml>
     */
    private static function cells(array $row, string $tag): array
    {
        return array_map(
            fn (string $cell): TrustedHtml => Html::h($tag, $tag === 'th' ? ['scope' => 'col'] : [], [Html::text($cell)]),
            $row,
        );
    }
}
