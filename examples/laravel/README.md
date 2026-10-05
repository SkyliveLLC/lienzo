# Lienzo in a Laravel app

A Laravel 13 app that installs Lienzo by following the [Laravel quickstart](../../README.md#laravel-quickstart) and nothing else. Composer installs the package from this repository through a path repository, so the app always runs the code next to it.

It adds one admin login, an editor page and three extensions:

- `app/Lienzo/LatestPosts.php` is an app element. Its fields appear in the editor, and it reads the newest posts from the database on every request.
- `Lienzo::siteFields()` in `app/Providers/AppServiceProvider.php` adds a phone number to the editor's site settings.
- `Lienzo::action('call_us', ...)` in the same provider adds a **Call us** button action that dials that phone number.

## Run it

You need PHP 8.3 or later with the `gd`, `pdo_sqlite`, `dom`, and `mbstring` extensions, and Composer.

```sh
cd examples/laravel
composer run setup
php artisan serve
```

`composer run setup` installs dependencies, creates `.env` and the SQLite database, and seeds an admin and three posts. It resets the database every time you run it.

Open <http://127.0.0.1:8000/admin> and sign in as `admin@example.com` with the password `password`. Build a page, click **Publish**, then open <http://127.0.0.1:8000/> in a private window to see it as a visitor.

## Run the end-to-end test

The test drives the editor in Chromium, publishes a page, and checks it as a guest. From the repository root:

```sh
pnpm install
pnpm exec playwright install chromium
pnpm --filter lienzo-example-laravel e2e
```

The test starts its own server on port 8124 and runs `composer run setup` first.

## Where each install step lives

| Step | File |
| --- | --- |
| `composer require skylive/lienzo` | `composer.json` |
| `php artisan lienzo:install` | `config/lienzo.php`, `database/migrations/*_create_lienzo_tables.php` |
| The `lienzo.manage` gate | `app/Providers/AppServiceProvider.php` |
| `Route::lienzoEditor()` and `Route::lienzo()` | `routes/web.php` |
| `<x-lienzo::editor>` | `resources/views/admin.blade.php` |
