<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Site editor</title>
    <style>
        body { display: flex; flex-direction: column; height: 100vh; margin: 0; font-family: system-ui, sans-serif; }
        header { display: flex; gap: 16px; align-items: center; padding: 8px 16px; border-bottom: 1px solid #e4e4e7; }
        header button { padding: 4px 10px; font: inherit; cursor: pointer; }
        lienzo-editor { flex: 1; min-height: 0; }
    </style>
</head>
<body>
    <header>
        <strong>{{ config('app.name') }}</strong>
        <span style="flex: 1"></span>
        <span>{{ auth()->user()->email }}</span>
        <form method="post" action="{{ route('logout') }}">@csrf <button>Sign out</button></form>
    </header>
    <x-lienzo::editor :site="$site" />
</body>
</html>
