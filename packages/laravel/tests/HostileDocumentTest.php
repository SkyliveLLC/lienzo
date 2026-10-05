<?php

declare(strict_types=1);

use Skylive\Lienzo\Document\DocumentError;
use Skylive\Lienzo\Document\ParsedDocument;
use Skylive\Lienzo\Document\ParsedSiteSettings;
use Skylive\Lienzo\Render\FormHost;
use Skylive\Lienzo\Render\MediaFile;
use Skylive\Lienzo\Render\PageInfo;
use Skylive\Lienzo\Render\RenderedPage;
use Skylive\Lienzo\Render\Renderer;
use Skylive\Lienzo\Render\RenderHost;
use Skylive\Lienzo\Render\RenderMode;
use Skylive\Lienzo\Render\TrustedHtml;
use Skylive\Lienzo\Tests\FixtureForm;
use Skylive\Lienzo\Tests\Fixtures;

// Hostile inputs that fail to parse are in fixtures/parse/inputs/hostile-*.json, checked by the parse goldens.
// These cover what parses and must render inert, and what a host could get wrong.

/** @param array<string, mixed> $element */
function hostileElement(array $element): array
{
    return [...['id' => 'e1', 'type' => 'text', 'z' => 1, 'layout' => ['desktop' => ['x' => 0, 'y' => 0, 'w' => 50, 'h' => 40], 'mobile' => null], 'props' => [], 'style' => []], ...$element];
}

/** @param array<string, mixed> $catalog */
function renderHostile(array $sectionExtra, array $elements, ?Closure $action = null, ?array $catalog = null, ?FormHost $form = null): RenderedPage
{
    $catalog ??= Fixtures::catalog();
    $host = new readonly class($action, $form) implements RenderHost
    {
        public function __construct(private ?Closure $actionHref, private ?FormHost $formHost) {}

        public function media(string $ref): ?MediaFile
        {
            return null;
        }

        public function action(array $action): ?string
        {
            return $this->actionHref === null ? null : ($this->actionHref)($action);
        }

        public function appElement(array $element): TrustedHtml
        {
            return new TrustedHtml('<b>app</b>');
        }

        public function form(): ?FormHost
        {
            return $this->formHost;
        }

        public function head(): ?TrustedHtml
        {
            return null;
        }

        public function nonce(): ?string
        {
            return null;
        }
    };
    $section = [...['id' => 's', 'height' => ['desktop' => 400, 'mobile' => 400], 'background' => ['type' => 'color', 'color' => 'background'], 'elements' => $elements], ...$sectionExtra];

    return Renderer::renderPage(
        document: ParsedDocument::parse(['sections' => [$section]], $catalog),
        catalog: $catalog,
        site: ParsedSiteSettings::parse(['name' => 'Demo']),
        page: new PageInfo('home', [], 'https://example.test/home'),
        base: '',
        mode: RenderMode::Public,
        host: $host,
    );
}

it('keeps script in text as escaped text, so the only script is the runtime', function (): void {
    $page = renderHostile([], [hostileElement(['props' => ['text' => '<script>alert(1)</script>', 'accent' => '<script>'], 'style' => ['accent_color' => 'primary']])]);

    expect($page->body->html)->toContain('<span class="lz-accent">&lt;script&gt;</span>alert(1)&lt;/script&gt;')
        ->and(substr_count($page->html, '<script'))->toBe(1);
});

it('keeps URLs out of the page CSS', function (): void {
    $page = renderHostile(['background' => ['type' => 'image', 'image' => 'https://example.test/bg.jpg']], [hostileElement(['type' => 'image', 'props' => ['src' => 'https://example.test/a.png']])]);

    expect($page->css)->not->toMatch('/url\(|https?:/')
        ->and($page->body->html)->toContain('<img alt="" class="lz-bg" decoding="async" src="https://example.test/bg.jpg">');
});

it('escapes submitted values and substitutes invalid UTF-8 from the request', function (): void {
    $form = new FixtureForm(['action' => '/submit', 'csrf' => null, 'old' => ['fields.e1' => "\"><script>x</script>\xC3"], 'errors' => [], 'notice' => null]);
    $page = renderHostile([], [hostileElement(['type' => 'input'])], form: $form);

    expect($page->body->html)->toContain('value="&quot;&gt;&lt;script&gt;x&lt;/script&gt;'."\u{FFFD}".'"');
});

it('refuses an app action href with an unsafe scheme instead of emitting it', function (): void {
    renderHostile([], [hostileElement(['type' => 'button', 'props' => ['label' => 'Go', 'action' => ['type' => 'booking']]])], fn (): string => 'javascript:alert(1)');
})->throws(LogicException::class, 'Refusing href');

it('refuses app CSS that closes the style tag', function (): void {
    $catalog = Fixtures::catalog();
    $catalog['elements'][0]['css'] = '</style><script>alert(1)</script>';

    renderHostile([], [hostileElement(['type' => $catalog['elements'][0]['type']])], catalog: $catalog);
})->throws(LogicException::class, 'closes the style tag');

it('rejects font names that would break out of font-family or the fonts URL', function (string $font): void {
    expect(fn () => ParsedSiteSettings::parse(['name' => 'Demo', 'theme' => ['heading_font' => $font]]))->toThrow(DocumentError::class);
})->with(["Inter';}body{x:y", 'Inter&family=Evil', "Inter\n"]);
