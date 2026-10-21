<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Tests\Feature;

use Skylive\Lienzo\Models\Site;
use Skylive\Lienzo\Tests\App\PanelProvider;
use Skylive\Lienzo\Tests\TestCase;

/** A class, not a Pest file: the provider order is the fixture, and only the test case decides it. */
final class BootOrderTest extends TestCase
{
    protected function getPackageProviders($app): array
    {
        return [PanelProvider::class, ...parent::getPackageProviders($app)];
    }

    public function test_a_package_that_boots_first_can_register_the_editor(): void
    {
        $site = Site::default();

        $this->actingAs(editor())->getJson("/panel/site/{$site->id}")->assertOk()->assertJsonPath('publicUrl', 'http://localhost');
    }
}
