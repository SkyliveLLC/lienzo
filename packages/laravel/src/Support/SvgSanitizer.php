<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Support;

use DOMAttr;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;

/**
 * Cuts an uploaded SVG down to what draws: shapes, gradients, filters and
 * presentation attributes. An SVG opened directly runs like a web page, so
 * scripts, event handlers, foreign content, external references and
 * entity declarations never reach the disk.
 */
final class SvgSanitizer
{
    private const array ELEMENTS = [
        'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'path', 'rect', 'circle', 'ellipse',
        'line', 'polyline', 'polygon', 'text', 'tspan', 'mask', 'clippath', 'filter',
        'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix', 'fecomposite', 'feflood', 'femerge',
        'femergenode', 'femorphology', 'lineargradient', 'radialgradient', 'stop', 'pattern', 'marker',
    ];

    private const array ATTRIBUTES = [
        'd', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
        'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'stroke-dasharray', 'stroke-opacity', 'opacity', 'transform', 'viewbox', 'preserveaspectratio',
        'points', 'offset', 'stop-color', 'stop-opacity', 'gradientunits', 'gradienttransform',
        'patternunits', 'clip-path', 'clip-rule', 'mask', 'filter', 'id', 'class', 'style',
        'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'xmlns',
        'stddeviation', 'result', 'in', 'in2', 'mode', 'type', 'values', 'operator', 'flood-color', 'href',
    ];

    /**
     * A value that runs code or loads something from elsewhere: only `url(#local)` references are kept.
     * A backslash is refused outright, because CSS escapes (`\75 rl(`) would hide the rest from this pattern.
     */
    private const string UNSAFE_VALUE = '/\\\\|javascript:|data:|@import|expression\s*\(|url\s*\(\s*[\'"]?\s*(?!#)/i';

    /** The cleaned SVG, or null when the input is not a usable SVG. */
    public static function clean(string $svg): ?string
    {
        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        // No LIBXML_NOENT: entities stay unexpanded, so no local file or entity bomb ends up in the output.
        $loaded = $document->loadXML($svg, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->documentElement;

        if (! $loaded || $root === null || strtolower($root->localName ?? '') !== 'svg' || $document->doctype?->entities->length > 0) {
            return null;
        }

        self::attributes($root);
        self::children($root);

        $clean = $document->saveXML($root);

        return is_string($clean) ? $clean : null;
    }

    private static function children(DOMNode $node): void
    {
        foreach (iterator_to_array($node->childNodes) as $child) {
            if ($child instanceof DOMElement && in_array(strtolower($child->localName ?? ''), self::ELEMENTS, true)) {
                self::attributes($child);
                self::children($child);
            } elseif (! $child instanceof DOMText) {
                $node->removeChild($child);
            }
        }
    }

    private static function attributes(DOMElement $element): void
    {
        foreach (iterator_to_array($element->attributes) as $attribute) {
            /** @var DOMAttr $attribute */
            $name = strtolower($attribute->localName ?? '');
            $safe = in_array($name, self::ATTRIBUTES, true)
                && preg_match(self::UNSAFE_VALUE, $attribute->value) !== 1
                && ($name !== 'href' || str_starts_with($attribute->value, '#'));

            if (! $safe) {
                $element->removeAttributeNode($attribute);
            }
        }
    }
}
