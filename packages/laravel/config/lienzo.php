<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Database Connection
    |--------------------------------------------------------------------------
    |
    | The connection holding the lienzo_* tables. Null uses the default one.
    | Set it when the app switches connections per request (tenancy).
    |
    */

    'connection' => env('LIENZO_DB_CONNECTION'),

    /*
    |--------------------------------------------------------------------------
    | Uploads
    |--------------------------------------------------------------------------
    |
    | Uploaded images live on this disk and are streamed through Lienzo's media
    | route, so the disk can be private (local or a bucket). Photos are
    | re-encoded to WebP with a thumbnail; SVGs are sanitized first.
    |
    */

    'disk' => env('LIENZO_DISK', 'local'),

    'upload_max_kb' => 6144,

    'quota' => [
        'files' => 200,
        'bytes' => 200 * 1024 * 1024,
    ],

    /*
    |--------------------------------------------------------------------------
    | Pages
    |--------------------------------------------------------------------------
    |
    | Published versions kept per page, and how many form submissions one
    | visitor may send per minute.
    |
    */

    'versions' => 30,

    'submissions_per_minute' => 10,

    /*
    |--------------------------------------------------------------------------
    | Editor
    |--------------------------------------------------------------------------
    |
    | Middleware for the editor's JSON routes, on top of the group they are
    | registered in. Every route also checks the `lienzo.manage` gate.
    |
    | The editor bundle ships with the package and is served by the editor
    | routes. Set `editor_url` to a directory URL holding lienzo-editor.js and
    | lienzo-editor.css to serve it from a CDN instead. `locale` is the
    | editor's default interface language.
    |
    */

    'editor_middleware' => ['auth'],

    'editor_url' => env('LIENZO_EDITOR_URL'),

    'locale' => 'en',

];
