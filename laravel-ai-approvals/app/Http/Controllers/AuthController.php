<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AuthController
{
    public function show(): View
    {
        return view('auth.login', [
            'demo' => self::demoMode() ? User::query()->whereIn('email', array_keys(self::DEMO_USERS))->orderBy('id')->get() : collect(),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::attempt($credentials, true)) {
            throw ValidationException::withMessages(['email' => __('support.auth.failed')]);
        }

        $request->session()->regenerate();

        return redirect()->intended(self::home(Auth::user()));
    }

    /** DEMO_MODE only: sign in as one of the seeded demo users. */
    public function demo(Request $request, User $user): RedirectResponse
    {
        abort_unless(self::demoMode() && array_key_exists($user->email, self::DEMO_USERS), 404);

        Auth::login($user);
        $request->session()->regenerate();

        return redirect(self::home($user));
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }

    public static function home(?User $user): string
    {
        return match (true) {
            $user?->isApprover() => '/admin/ai-approvals',
            $user?->isCustomer() => route('support'),
            default => route('forbidden'),
        };
    }

    public static function demoMode(): bool
    {
        return (bool) config('support.demo_mode') && ! app()->environment('production');
    }

    /** The seeded demo accounts (DemoSeeder); one-click sign-in lists only these. */
    public const DEMO_USERS = [
        'customer@demo.test' => User::CUSTOMER,
        'manager.a@demo.test' => User::APPROVER,
        'manager.b@demo.test' => User::APPROVER,
        'outsider@demo.test' => User::NONE,
    ];
}
