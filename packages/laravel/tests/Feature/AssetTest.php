<?php

declare(strict_types=1);

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Skylive\Lienzo\Models\Asset;

beforeEach(fn () => Storage::fake('lienzo-test'));

it('stores a photo as webp with a thumbnail and serves both', function (): void {
    [$site, $endpoint] = signedIn();

    $asset = $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->image('beach.jpg', 3600, 1200)], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('name', 'beach.jpg')
        ->assertJsonPath('width', 1800)
        ->assertJsonPath('height', 600)
        ->json();

    $stored = Asset::query()->findOrFail($asset['id']);
    expect($asset['ref'])->toBe("media:{$stored->id}")
        ->and($stored->mime)->toBe('image/webp')
        ->and(getimagesizefromstring(Storage::disk('lienzo-test')->get($stored->thumb_path)))->toMatchArray([0 => 480, 1 => 160, 'mime' => 'image/webp']);

    $this->get($asset['thumb'])->assertOk()->assertHeader('Content-Type', 'image/webp')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, private');
    $this->getJson($endpoint)->assertJsonPath('quota.used', $stored->size)->assertJsonPath('assets.0.id', $stored->id);
});

it('keeps the shapes of an svg and drops anything that runs or loads', function (): void {
    [, $endpoint] = signedIn();
    $svg = <<<'SVG'
        <?xml version="1.0"?>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">
          <script>alert(2)</script>
          <foreignObject><div>html</div></foreignObject>
          <a href="javascript:alert(3)"><circle r="1"/></a>
          <rect width="10" height="10" fill="url(#g)" style="fill:url(https://tracker.example/p.png)"/>
          <circle r="2" style="fill:\75 rl(https://escaped.example/p.png)"/>
          <use xlink:href="https://evil.example/sprite.svg#x"/>
          <path d="M0 0L10 10" stroke="red"/>
        </svg>
        SVG;

    $asset = $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->createWithContent('logo.svg', $svg)], ['Accept' => 'application/json'])
        ->assertCreated()
        ->json();

    $clean = Storage::disk('lienzo-test')->get(Asset::query()->findOrFail($asset['id'])->path);
    expect($clean)->toContain('<path d="M0 0L10 10" stroke="red"/>')
        ->toContain('<rect width="10" height="10" fill="url(#g)"/>')
        ->not->toContain('script')
        ->not->toContain('onload')
        ->not->toContain('foreignObject')
        ->not->toContain('javascript')
        ->not->toContain('tracker.example')
        ->not->toContain('escaped.example')
        ->not->toContain('evil.example');

    $this->get($asset['url'])->assertOk()->assertHeader('Content-Type', 'image/svg+xml')
        ->assertHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
});

it('refuses an svg that declares entities', function (): void {
    [, $endpoint] = signedIn();
    $svg = '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&secret;</text></svg>';

    $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->createWithContent('x.svg', $svg)], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('issues.0', ['path' => 'file', 'code' => 'type', 'message' => 'That SVG could not be read. Export it again and retry.']);

    expect(Asset::query()->count())->toBe(0);
});

it('refuses uploads over the quota and files that are not images', function (): void {
    config(['lienzo.quota.bytes' => 1000]);
    [, $endpoint] = signedIn();

    $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->image('big.png', 400, 400)->size(2)], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('issues.0.path', 'file')
        ->assertJsonPath('issues.0.code', 'size');

    $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->create('notes.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('issues.0.code', 'enum');

    expect(Asset::query()->count())->toBe(0);
});

it('refuses images too large to decode before decoding them', function (): void {
    [, $endpoint] = signedIn();
    // A PNG header claiming 10000 x 10000 pixels; GD would need 400 MB to decode it.
    $header = pack('N', 13).'IHDR'.pack('NN', 10000, 10000)."\x08\x02\x00\x00\x00";
    $png = "\x89PNG\r\n\x1a\n".$header.pack('N', crc32(substr($header, 4)));

    $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->createWithContent('huge.png', $png)], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('issues.0.message', 'That image is too large. Upload one under 25 megapixels.');
});

it('deletes an image with its files', function (): void {
    [$site, $endpoint] = signedIn();
    $id = $this->post("{$endpoint}/assets", ['file' => UploadedFile::fake()->image('a.png', 600, 600)], ['Accept' => 'application/json'])->json('id');
    $asset = Asset::query()->findOrFail($id);

    $this->deleteJson("{$endpoint}/assets/{$id}")->assertOk();

    Storage::disk('lienzo-test')->assertMissing([$asset->path, $asset->thumb_path]);
    expect($site->assets()->count())->toBe(0);
});
