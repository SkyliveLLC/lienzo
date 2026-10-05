<?php

declare(strict_types=1);

use Orchestra\Testbench\Factories\UserFactory;
use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Tests\App\Team;

it('gives each owner one site, created on first use', function (): void {
    $owner = UserFactory::new()->create();
    $site = Site::forOwner($owner, ['name' => 'Acme']);

    expect(Site::forOwner($owner, ['name' => 'Ignored'])->is($site))->toBeTrue()
        ->and($site->name)->toBe('Acme')
        ->and($site->owner->is($owner))->toBeTrue()
        ->and(Site::forOwner(UserFactory::new()->create())->is($site))->toBeFalse()
        ->and(Site::default()->is($site))->toBeFalse()
        ->and(Site::default()->is(Site::default()))->toBeTrue();
});

it('reaches the site from an owner model', function (): void {
    $owner = Team::query()->findOrFail(UserFactory::new()->create()->id);

    expect($owner->lienzoSite)->toBeNull();

    $site = Site::forOwner($owner);

    expect($owner->lienzoSite()->first()?->is($site))->toBeTrue();
});
