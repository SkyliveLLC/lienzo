<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Render;

use LogicException;
use Skylive\Lienzo\Assets;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Document\ParsedSiteSettings;
use Skylive\Lienzo\Render\Elements\CoreElements;
use Skylive\Lienzo\Render\Elements\ElementContext;
use Skylive\Lienzo\Render\Elements\ElementNode;
use Skylive\Lienzo\Support\Js;

/**
 * The PHP twin of core's `renderPage`, byte for byte (checked against every
 * fixtures/render golden). Walks groups, sections and modals, then
 * elements: core elements through their renderer class, app elements
 * through the host. Every element root gets id `e-<id>`, class `lz-el`, its
 * style projection and a vars block.
 *
 * @phpstan-import-type Catalog from ParsedDocument
 * @phpstan-import-type Group from Canvas
 */
final class Renderer
{
    /** Custom property values allowed in a vars block: a number, a hex color or a theme token. */
    private const string VAR_VALUE = '/^(-?\d+(\.\d+)?|#[0-9a-fA-F]{6}|var\(--(primary|secondary|background|surface|text|muted)\))$/D';

    /** @var list<string> one `#id{--var:..}` rule per section, modal and element, in document order */
    private array $rules = [];

    /** @var array<string, true> app element types on the page, for their CSS */
    private array $appTypes = [];

    /** @var array<string, string> */
    private readonly array $t;

    private readonly ?FormHost $form;

    /** @param Catalog $catalog */
    private function __construct(
        private readonly array $catalog,
        private readonly ParsedSiteSettings $site,
        private readonly PageInfo $page,
        private readonly string $base,
        private readonly RenderMode $mode,
        private readonly RenderHost $host,
    ) {
        $this->t = Messages::for($site->locale);
        $this->form = $host->form();
    }

    /**
     * @param  Catalog  $catalog
     * @param  string  $base  path prefix for `page` actions, '' when pages live at the root
     */
    public static function renderPage(
        ParsedDocument $document,
        array $catalog,
        ParsedSiteSettings $site,
        PageInfo $page,
        string $base,
        RenderMode $mode,
        RenderHost $host,
    ): RenderedPage {
        return (new self($catalog, $site, $page, $base, $mode, $host))->render($document->toArray());
    }

    /** @param array{sections: list<array<string, mixed>>, modals?: ?list<array<string, mixed>>} $document */
    private function render(array $document): RenderedPage
    {
        $groups = array_map($this->group(...), Canvas::groupSections($document['sections']));
        $modals = array_map($this->modal(...), $document['modals'] ?? []);
        $notice = $this->form?->notice() ?? '';
        $body = Html::fragment([
            $notice !== '' ? Html::h('p', ['class' => 'lz-notice', 'role' => 'status'], [Html::text($notice)]) : null,
            ...$groups,
            ...$modals,
        ]);

        $css = implode("\n", [$this->pageRule($document), ...$this->rules, ...$this->appCss()])."\n";
        $site = $this->site;
        $title = self::filled($this->page->seo['title'] ?? null) ?? self::filled($site->seo['title'] ?? null) ?? $site->name;
        $description = self::filled($this->page->seo['description'] ?? null) ?? self::filled($site->seo['description'] ?? null);
        $share = self::filledUrl($this->resolveMedia($site->ogImage));
        $favicon = self::filledUrl($this->resolveMedia($site->favicon));
        $fonts = implode('&', array_map(
            fn (string $font): string => 'family='.str_replace(' ', '+', $font).':wght@300;400;500;600;700;800',
            array_values(array_unique([$site->theme['heading_font'], $site->theme['body_font']])),
        ));

        $meta = [
            ...($description !== null ? [['name' => 'description', 'content' => $description]] : []),
            ['property' => 'og:title', 'content' => $title],
            ['property' => 'og:type', 'content' => 'website'],
            ['property' => 'og:url', 'content' => $this->page->url],
            ['property' => 'og:site_name', 'content' => $site->name],
            ...($description !== null ? [['property' => 'og:description', 'content' => $description]] : []),
            ...($share !== null ? [
                ['property' => 'og:image', 'content' => $share],
                ['name' => 'twitter:card', 'content' => 'summary_large_image'],
                ['name' => 'twitter:image', 'content' => $share],
            ] : []),
        ];
        $links = [
            ...($favicon !== null ? [['rel' => 'icon', 'href' => $favicon], ['rel' => 'apple-touch-icon', 'href' => $favicon]] : []),
            ['rel' => 'canonical', 'href' => $this->page->url],
            ['rel' => 'preconnect', 'href' => 'https://fonts.googleapis.com'],
            ['rel' => 'preconnect', 'href' => 'https://fonts.gstatic.com', 'crossorigin' => true],
            ['rel' => 'stylesheet', 'href' => "https://fonts.googleapis.com/css2?{$fonts}&display=swap"],
        ];

        $nonce = $this->host->nonce() ?? '';
        $nonce = $nonce !== '' ? ' nonce="'.Html::escape($nonce).'"' : '';
        $head = $this->host->head();
        $html = '<!DOCTYPE html>'
            .'<html lang="'.Html::escape($site->locale).'"><head>'
            .Html::h('meta', ['charset' => 'utf-8'])
            .Html::h('meta', ['name' => 'viewport', 'content' => 'width=device-width, initial-scale=1'])
            .'<title>'.Html::escape($title).'</title>'
            .implode('', array_map(fn (array $entry): string => Html::h('meta', $entry)->html, $meta))
            .implode('', array_map(fn (array $entry): string => Html::h('link', $entry)->html, $links))
            ."<style{$nonce}>\n".Assets::stylesheet().$css.'</style>'
            .($head->html ?? '')
            .'</head><body class="lz-page">'.$body->html
            .($this->mode === RenderMode::Public ? "<script{$nonce}>\n".Assets::runtime().'</script>' : '')
            ."</body></html>\n";

        return new RenderedPage($site->locale, $title, $meta, $links, $css, $body, $head, $html);
    }

    private static function filled(?string $value): ?string
    {
        return $value !== null && Js::trim($value) !== '' ? $value : null;
    }

    private static function filledUrl(?MediaFile $file): ?string
    {
        return ($file->url ?? '') === '' ? null : $file->url;
    }

    private function resolveMedia(?string $src): ?MediaFile
    {
        if ($src === null || $src === '') {
            return null;
        }

        return str_starts_with($src, 'media:') ? $this->host->media($src) : new MediaFile($src);
    }

    /** @param array{sections: list<array<string, mixed>>} $document */
    private function pageRule(array $document): string
    {
        $theme = $this->site->theme;
        $sticky = 0;

        foreach ($document['sections'] as $section) {
            foreach ($section['elements'] as $element) {
                if ($element['type'] === 'navbar' && ($element['props']['sticky'] ?? null) === true) {
                    $sticky = max($sticky, (int) $element['layout']['desktop']['h'] + 24);
                }
            }
        }

        return ".lz-page{--primary:{$theme['primary']};--secondary:{$theme['secondary']};--background:{$theme['background']};"
            ."--surface:{$theme['surface']};--text:{$theme['text']};--muted:{$theme['muted']};--radius:{$theme['radius']}px;"
            ."--max-width:{$theme['max_width']}px;--ref:{$theme['max_width']};"
            ."--font-heading:'{$theme['heading_font']}', system-ui, sans-serif;--font-body:'{$theme['body_font']}', system-ui, sans-serif"
            .($sticky > 0 ? ";--sticky:{$sticky}" : '')
            .'}';
    }

    /**
     * App CSS is trusted developer code, nested under its type so its selectors match inside that element.
     *
     * @return list<string>
     */
    private function appCss(): array
    {
        $css = [];

        foreach ($this->catalog['elements'] as $spec) {
            if (! isset($this->appTypes[$spec['type']]) || ($spec['css'] ?? '') === '') {
                continue;
            }

            if (preg_match('/<\/style/i', $spec['css']) === 1) {
                throw new LogicException("Refusing CSS for app element {$spec['type']}: it closes the style tag");
            }

            $css[] = ".lz-el[data-type=\"{$spec['type']}\"]{{$spec['css']}}";
        }

        return $css;
    }

    /** @param list<array{0: string, 1: string}> $vars */
    private static function rule(string $selector, array $vars): string
    {
        foreach ($vars as [$name, $value]) {
            if (preg_match(self::VAR_VALUE, $value) !== 1) {
                throw new LogicException("Refusing --{$name}:{$value}");
            }
        }

        return $selector.'{'.implode(';', array_map(fn (array $var): string => "--{$var[0]}:{$var[1]}", $vars)).'}';
    }

    /** @param Group $group */
    private function group(array $group): TrustedHtml
    {
        if ($group['kind'] === 'single') {
            return $this->section($group['section'], Canvas::isForm($group['section']) ? 'form' : null);
        }

        $stepsForm = Canvas::isStepsForm($group);
        $steps = $group['type'] === 'steps';
        $panels = [];
        $buttons = [];

        foreach ($group['sections'] as $index => $section) {
            $panels[] = Html::h('div', ['class' => 'lz-stack-panel', 'data-panel' => $index, 'data-on' => $index === 0], [
                $this->section($section, Canvas::isForm($section) ? ($stepsForm ? 'div' : 'form') : null),
            ]);
        }

        foreach ($group['sections'] as $index => $section) {
            $position = (string) ($index + 1);
            $fallback = $this->t[$steps ? 'step' : 'tab'];
            $buttons[] = Html::h('button', ['type' => 'button', 'data-go' => $index, 'aria-pressed' => $index === 0 ? 'true' : 'false'], [
                $steps ? Html::h('i', [], [Html::text($position)]) : null,
                Html::text(self::filled($section['group']['label'] ?? null) ?? self::replaceFirst($fallback, '{n}', $position)),
            ]);
        }

        $nav = Html::h('nav', ['class' => 'lz-stack-nav', 'aria-label' => $this->t['sections']], $buttons);
        $attrs = ['class' => 'lz-stack', 'id' => 'g-'.Canvas::safeId($group['id']), 'data-group' => $group['type']];
        $children = [$nav, Html::h('div', ['class' => 'lz-stack-panels'], $panels)];

        return $stepsForm ? $this->form($attrs, $group['id'], $children) : Html::h('div', $attrs, $children);
    }

    private static function replaceFirst(string $subject, string $search, string $replace): string
    {
        $at = strpos($subject, $search);

        return $at === false ? $subject : substr_replace($subject, $replace, $at, strlen($search));
    }

    /**
     * A form canvas wraps its elements in a block inside the frame, which is
     * also what decides their stacked order on mobile. Inside a steps form
     * that block is a plain `div`, so a step looks the same as a standalone form section.
     *
     * @param  array<string, mixed>  $section
     * @param  'form'|'div'|null  $wrap
     */
    private function section(array $section, ?string $wrap): TrustedHtml
    {
        $id = Canvas::safeId($section['id']);
        $background = $section['background'];
        $type = $background['type'];
        $image = $type === 'image' ? $this->resolveMedia($background['image'] ?? null) : null;
        $gradient = $background['gradient'] ?? null;
        $gradient = $type === 'gradient' && ($gradient['from'] ?? '') !== '' && ($gradient['to'] ?? '') !== '' ? $gradient : null;
        $vars = [['fh', Html::num($section['height']['desktop'])], ['fmh', Html::num($section['height']['mobile'])]];

        if ($gradient !== null) {
            $vars[] = ['sg1', Style::color($gradient['from'])];
            $vars[] = ['sg2', Style::color($gradient['to'])];

            if (($gradient['angle'] ?? null) !== null) {
                $vars[] = ['sga', Html::num($gradient['angle'])];
            }
        // An image background keeps its old color only as editor state; a deleted image leaves the section bare.
        } elseif (! ($type === 'image' && ($background['image'] ?? '') !== '') && ($background['color'] ?? '') !== '') {
            $vars[] = ['sbg', Style::color($background['color'])];
        }

        $overlay = $background['overlay'] ?? 0;

        if ($overlay > 0) {
            $vars[] = ['ov', Html::num($overlay)];
        }

        $this->rules[] = self::rule("#s-{$id}", $vars);

        $elements = $this->canvas($section);
        // Stacked on mobile, a form's elements flow inline in its block, where the space between them shows.
        $spaced = [];

        foreach ($elements as $index => $element) {
            array_push($spaced, ...($index === 0 ? [$element] : [Html::text(' '), $element]));
        }

        $backdrop = null;

        if ($image !== null) {
            $img = Html::h('img', ['class' => 'lz-bg', 'src' => $image->url, 'alt' => '', 'decoding' => 'async']);
            $backdrop = ($background['parallax'] ?? null) === true ? Html::h('div', ['class' => 'lz-parallax'], [$img]) : $img;
        }

        return Html::h('section', [
            'id' => "s-{$id}",
            'class' => 'lz-section',
            'data-fill' => $gradient !== null ? $gradient['type'] ?? 'linear' : null,
        ], [
            $backdrop,
            $overlay > 0 ? Html::h('div', ['class' => 'lz-overlay']) : null,
            Html::h('div', ['class' => 'lz-frame', 'data-stack' => Canvas::stacks($section)], [match ($wrap) {
                'form' => $this->form([], $section['id'], $spaced),
                'div' => Html::h('div', [], $spaced),
                null => Html::fragment($elements),
            }]),
        ]);
    }

    /** @param array<string, mixed> $modal */
    private function modal(array $modal): TrustedHtml
    {
        $id = Canvas::safeId($modal['id']);

        $this->rules[] = self::rule("#m-{$id}", [
            ['dw', Html::num($modal['width'])],
            ['dbg', Style::color($modal['background']['color'] ?? 'background')],
            ['fh', Html::num($modal['height']['desktop'])],
            ['fmh', Html::num($modal['height']['mobile'])],
        ]);

        $frame = Html::h('div', ['class' => 'lz-frame', 'data-stack' => Canvas::stacks($modal)], $this->canvas($modal));

        return Html::h('dialog', [
            'id' => "m-{$id}",
            'class' => 'lz-modal',
            'aria-label' => $modal['title'],
            'data-size' => $modal['size'] ?? null,
            'data-open' => $this->form !== null && $this->form->old('source') === $modal['id'],
        ], [
            Html::h('div', ['class' => 'lz-modal-bar'], [
                ($modal['show_title'] ?? null) === true ? Html::h('h2', ['class' => 'lz-modal-title'], [Html::text($modal['title'])]) : null,
                Html::h('button', ['type' => 'button', 'class' => 'lz-modal-close', 'data-close' => true, 'aria-label' => $this->t['close']], [Html::text('×')]),
            ]),
            Canvas::isForm($modal) ? $this->form([], $modal['id'], [$frame]) : $frame,
        ]);
    }

    /**
     * A live form posts `source` so the server can look up the fields of the published canvas.
     *
     * @param  array<string, string>  $attrs
     * @param  list<TrustedHtml|null|false>  $children
     */
    private function form(array $attrs, string $source, array $children): TrustedHtml
    {
        if ($this->form === null) {
            return Html::h('form', $attrs, $children);
        }

        $csrf = $this->form->csrf();

        return Html::h('form', [...$attrs, 'method' => 'post', 'action' => $this->form->action()], [
            $csrf !== null ? Html::h('input', ['type' => 'hidden', 'name' => $csrf['name'], 'value' => $csrf['value']]) : null,
            Html::h('input', ['type' => 'hidden', 'name' => 'slug', 'value' => $this->page->slug]),
            Html::h('input', ['type' => 'hidden', 'name' => 'source', 'value' => $source]),
            Html::h('input', ['type' => 'text', 'name' => 'website', 'tabindex' => '-1', 'autocomplete' => 'off', 'hidden' => true]),
            ...$children,
        ]);
    }

    /**
     * @param  array<string, mixed>  $canvas
     * @return list<TrustedHtml>
     */
    private function canvas(array $canvas): array
    {
        $order = Canvas::stacks($canvas) ? Canvas::stackOrder($canvas['elements']) : [];
        $live = Canvas::isForm($canvas) ? $this->form : null;
        $appActions = array_column($this->catalog['actions'], 'type');
        $context = new ElementContext(
            $this->t,
            $this->resolveMedia(...),
            fn (?array $action): ?array => Actions::attrs(
                $action,
                $this->base,
                fn (array $app): ?string => in_array($app['type'], $appActions, true) ? $this->host->action($app) : null,
            ),
            $live,
        );

        return array_map(
            fn (array $element, int $index): TrustedHtml => $this->element($element, $order[$index] ?? null, $context),
            $canvas['elements'],
            array_keys($canvas['elements']),
        );
    }

    /** @param array<string, mixed> $element */
    private function element(array $element, ?int $order, ElementContext $context): TrustedHtml
    {
        $type = $element['type'];
        $core = CoreElements::RENDERERS[$type] ?? null;
        $isApp = $core === null && in_array($type, array_column($this->catalog['elements'], 'type'), true);

        $node = match (true) {
            $core !== null => $core::render($element, $context),
            $isApp => new ElementNode('div', attrs: ['data-type' => $type], children: [$this->host->appElement($element)]),
            $this->mode === RenderMode::Edit => new ElementNode('div', 'lz-placeholder', ['data-type' => $type], [Html::text($this->t['unavailable'])]),
            default => null,
        };

        if ($node === null) {
            return new TrustedHtml('');
        }

        if ($core === null) {
            $this->appTypes[$type] = true;
        }

        $id = Canvas::safeId($element['id']);
        $desktop = $element['layout']['desktop'];
        $mobile = $element['layout']['mobile'] ?? null;
        $style = Style::project($element['style']);
        $layout = [['x', Html::num($desktop['x'])], ['y', Html::num($desktop['y'])], ['w', Html::num($desktop['w'])], ['h', Html::num($desktop['h'])]];

        if ($order !== null) {
            $layout[] = ['ord', Html::num($order)];
        } elseif ($mobile !== null) {
            array_push($layout, ['mx', Html::num($mobile['x'])], ['my', Html::num($mobile['y'])], ['mw', Html::num($mobile['w'])], ['mh', Html::num($mobile['h'])]);
        }

        $layout[] = ['z', Html::num($element['z'])];
        $this->rules[] = self::rule("#e-{$id}", [...$layout, ...$style['vars']]);

        $attrs = $style['attrs'];

        if ($this->mode === RenderMode::Edit) {
            unset($attrs['data-anim']);
        }

        return Html::h($node->tag, [
            ...$node->attrs,
            ...$attrs,
            'id' => "e-{$id}",
            'class' => $node->class !== null ? "lz-el {$node->class}" : 'lz-el',
        ], $node->children);
    }
}
