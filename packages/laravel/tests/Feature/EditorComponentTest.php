<?php

declare(strict_types=1);

use Skylive\Lienzo\Models\Site;

it('renders the editor element pointed at the site', function (): void {
    $site = Site::default();
    $this->startSession();

    $html = (string) $this->blade('<x-lienzo::editor :site="$site" locale="es" class="h-screen" />', ['site' => $site]);

    expect($html)
        ->toContain('<script type="module" src="http://localhost/admin/site/lienzo-editor.js"')
        ->toContain('<link rel="stylesheet" href="http://localhost/admin/site/lienzo-editor.css"')
        ->toContain('<lienzo-editor endpoint="http://localhost/admin/site/'.$site->id.'" locale="es" headers="'.e(json_encode(['X-CSRF-TOKEN' => csrf_token(), 'Accept' => 'application/json'])).'" class="h-screen"></lienzo-editor>');
});

it('loads the bundle from the configured URL instead', function (): void {
    config(['lienzo.editor_url' => 'https://cdn.example/lienzo/']);

    expect((string) $this->blade('<x-lienzo::editor :site="$site" />', ['site' => Site::default()]))
        ->toContain('src="https://cdn.example/lienzo/lienzo-editor.js"')
        ->toContain('locale="en"');
});
