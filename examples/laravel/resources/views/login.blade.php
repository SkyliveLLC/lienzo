<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in</title>
    <style>
        body { display: grid; place-items: center; min-height: 100vh; margin: 0; font-family: system-ui, sans-serif; background: #f4f4f5; }
        form { display: grid; gap: 12px; width: 300px; padding: 28px; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px #0002; }
        input, button { padding: 10px; font: inherit; border: 1px solid #d4d4d8; border-radius: 8px; }
        button { border: 0; background: #18181b; color: #fff; cursor: pointer; }
        .error { margin: 0; color: #b91c1c; font-size: 14px; }
    </style>
</head>
<body>
    <form method="post" action="{{ route('login') }}">
        @csrf
        <h1 style="margin: 0 0 8px; font-size: 20px">Sign in to edit the site</h1>
        <label>Email <input type="email" name="email" value="{{ old('email', 'admin@example.com') }}" required></label>
        <label>Password <input type="password" name="password" required></label>
        @error('email') <p class="error">{{ $message }}</p> @enderror
        <button>Sign in</button>
    </form>
</body>
</html>
