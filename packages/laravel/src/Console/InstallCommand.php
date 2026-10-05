<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Console;

use Illuminate\Console\Command;
use Illuminate\Filesystem\Filesystem;
use Symfony\Component\Console\Attribute\AsCommand;

#[AsCommand(name: 'lienzo:install')]
final class InstallCommand extends Command
{
    protected $signature = 'lienzo:install';

    protected $description = 'Publish the Lienzo config and migrations';

    public function handle(Filesystem $files): int
    {
        $this->callSilently('vendor:publish', ['--tag' => 'lienzo-config']);

        // Publishing stamps migrations with the current time, so a second run would add a duplicate.
        if ($files->glob(database_path('migrations/*_create_lienzo_tables.php')) === []) {
            $this->callSilently('vendor:publish', ['--tag' => 'lienzo-migrations']);
        }

        $this->components->info('Lienzo is installed. Next:');
        $this->components->bulletList([
            'Run <comment>php artisan migrate</comment>.',
            'Say who edits a site, in a service provider: <comment>Gate::define(\'lienzo.manage\', fn (User $user, Site $site): bool => ...)</comment>.',
            'Add the routes to routes/web.php: <comment>Route::lienzoEditor(\'admin/site\')</comment> inside your auth group, and <comment>Route::lienzo()</comment> last.',
            'Put the editor on an admin page: <comment><x-lienzo::editor :site="Skylive\Lienzo\Models\Site::default()" /></comment>.',
        ]);

        return self::SUCCESS;
    }
}
