<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title') · {{ __('support.app_name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="min-h-screen bg-slate-50 text-slate-900 antialiased">
    <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <a href="{{ url('/') }}" class="font-semibold">{{ __('support.app_name') }}</a>
            @auth
                <form method="post" action="{{ route('logout') }}" class="flex items-center gap-3 text-sm">
                    @csrf
                    <span class="text-slate-500">{{ auth()->user()->name }}</span>
                    <button class="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-600">{{ __('support.auth.logout') }}</button>
                </form>
            @endauth
        </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-6">
        @yield('content')
    </main>
</body>
</html>
