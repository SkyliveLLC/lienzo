<?php

declare(strict_types=1);

namespace Skylive\Lienzo;

use GdImage;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Skylive\Lienzo\Document\IssueCode;
use Skylive\Lienzo\Http\ProtocolException;
use Skylive\Lienzo\Models\Asset;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Support\SvgSanitizer;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A site's uploaded images on the `lienzo.disk` disk. Photos are re-encoded
 * to WebP (longest side 1800px) with a 480px thumbnail, so nobody publishes
 * an 8 MB original by accident; SVGs are sanitized before they touch the disk.
 */
final class AssetLibrary
{
    private const int MAX_SIDE = 1800;

    private const int THUMB_SIDE = 480;

    /** Decoding takes about 4 bytes a pixel, so bigger images are refused before GD sees them. */
    private const int MAX_PIXELS = 25_000_000;

    /** @throws ProtocolException when the library is full or the file is not a readable image */
    public function store(Site $site, UploadedFile $file): Asset
    {
        $quota = $this->quota($site);

        if ($site->assets()->count() >= config('lienzo.quota.files') || $quota['limit'] < $quota['used'] + $file->getSize()) {
            throw ProtocolException::issue('file', IssueCode::Size, 'The image library is full. Delete some images before uploading another.');
        }

        $name = mb_substr($file->getClientOriginalName() ?: 'image', 0, 160);
        $key = "lienzo/{$site->id}/".Str::uuid();
        $contents = (string) file_get_contents($file->getRealPath());

        $attributes = strtolower($file->getClientOriginalExtension()) === 'svg' || $file->getMimeType() === 'image/svg+xml'
            ? $this->vector($contents, $key)
            : $this->photo($contents, $key);

        return $site->assets()->create(['name' => $name, ...$attributes]);
    }

    /** Removes the files with the record. Pages that used the image render without it. */
    public function delete(Asset $asset): void
    {
        $this->disk()->delete(array_filter([$asset->path, $asset->thumb_path]));
        $asset->delete();
    }

    /** @return array{used: int, limit: int} bytes */
    public function quota(Site $site): array
    {
        return ['used' => (int) $site->assets()->sum('size'), 'limit' => (int) config('lienzo.quota.bytes')];
    }

    /**
     * Streams the file (or its thumbnail), so the disk can be private or a
     * bucket. Ids never change content, so caches may keep it for good;
     * `$public` says whether shared caches may too.
     */
    public function response(Asset $asset, bool $thumb, bool $public): StreamedResponse
    {
        $path = $thumb && $asset->thumb_path !== null ? $asset->thumb_path : $asset->path;

        abort_unless($this->disk()->exists($path), 404);

        return $this->disk()->response($path, headers: [
            'Content-Type' => $thumb && $asset->thumb_path !== null ? 'image/webp' : $asset->mime,
            'Cache-Control' => ($public ? 'public' : 'private').', max-age=31536000, immutable',
            // An SVG opened on its own is a document; nothing in it may run or load.
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'",
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** @return array{path: string, thumb_path: null, mime: string, size: int, width: null, height: null} */
    private function vector(string $contents, string $key): array
    {
        $clean = SvgSanitizer::clean($contents)
            ?? throw ProtocolException::issue('file', IssueCode::Type, 'That SVG could not be read. Export it again and retry.');

        $this->disk()->put("{$key}.svg", $clean);

        return ['path' => "{$key}.svg", 'thumb_path' => null, 'mime' => 'image/svg+xml', 'size' => strlen($clean), 'width' => null, 'height' => null];
    }

    /** @return array{path: string, thumb_path: string, mime: string, size: int, width: int, height: int} */
    private function photo(string $contents, string $key): array
    {
        $size = @getimagesizefromstring($contents);

        if ($size !== false && $size[0] * $size[1] > self::MAX_PIXELS) {
            throw ProtocolException::issue('file', IssueCode::Size, 'That image is too large. Upload one under 25 megapixels.');
        }

        $source = ($size !== false ? @imagecreatefromstring($contents) : false)
            ?: throw ProtocolException::issue('file', IssueCode::Type, 'That image could not be read. Upload a JPG, PNG or WebP.');

        $full = $this->encode($this->resize($source, self::MAX_SIDE));
        $this->disk()->put("{$key}.webp", $full['bytes']);
        $this->disk()->put("{$key}-thumb.webp", $this->encode($this->resize($source, self::THUMB_SIDE))['bytes']);

        return [
            'path' => "{$key}.webp",
            'thumb_path' => "{$key}-thumb.webp",
            'mime' => 'image/webp',
            'size' => strlen($full['bytes']),
            'width' => $full['width'],
            'height' => $full['height'],
        ];
    }

    private function resize(GdImage $image, int $side): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $ratio = min(1, $side / max($width, $height));
        // A very thin image would round a side to 0, which GD refuses.
        $target = imagecreatetruecolor(max(1, (int) round($width * $ratio)), max(1, (int) round($height * $ratio)));

        imagealphablending($target, false);
        imagesavealpha($target, true);
        imagecopyresampled($target, $image, 0, 0, 0, 0, imagesx($target), imagesy($target), $width, $height);

        return $target;
    }

    /** @return array{bytes: string, width: int, height: int} */
    private function encode(GdImage $image): array
    {
        ob_start();
        imagewebp($image, null, 82);

        return ['bytes' => (string) ob_get_clean(), 'width' => imagesx($image), 'height' => imagesy($image)];
    }

    private function disk(): FilesystemAdapter
    {
        /** @var FilesystemAdapter */
        return Storage::disk(config('lienzo.disk'));
    }
}
