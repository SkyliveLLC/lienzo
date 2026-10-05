<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

/** The smallest possible session login, enough to put the editor behind `auth`. */
class LoginController extends Controller
{
    public function create(): View
    {
        return view('login');
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate(['email' => ['required', 'email'], 'password' => ['required']]);

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('admin'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
