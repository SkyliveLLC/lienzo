<?php

declare(strict_types=1);

namespace Skylive\Lienzo\Http;

use Illuminate\Http\Request;
use Illuminate\Support\ViewErrorBag;
use Skylive\Lienzo\Render\FormHost;

/**
 * Form state from the session: the CSRF token, the input and errors of a
 * failed submission, and the notice after a successful one.
 */
final readonly class SessionForm implements FormHost
{
    /** Session flash key of the notice shown after a submission. */
    public const string NOTICE = 'lienzo.notice';

    public function __construct(private Request $request, private string $action) {}

    public function action(): string
    {
        return $this->action;
    }

    public function csrf(): ?array
    {
        return $this->request->hasSession() ? ['name' => '_token', 'value' => $this->request->session()->token()] : null;
    }

    public function old(string $key): ?string
    {
        $value = $this->request->hasSession() ? $this->request->old($key) : null;

        return is_scalar($value) ? (string) $value : null;
    }

    public function error(string $key): ?string
    {
        $errors = $this->request->hasSession() ? $this->request->session()->get('errors') : null;
        $message = $errors instanceof ViewErrorBag ? $errors->getBag('default')->first($key) : '';

        return $message === '' ? null : $message;
    }

    /** The flashed notice, or why a submission was refused as a whole (its form is gone), which no field shows. */
    public function notice(): ?string
    {
        $notice = $this->request->hasSession() ? $this->request->session()->get(self::NOTICE) : null;

        return is_string($notice) ? $notice : $this->error('source');
    }
}
