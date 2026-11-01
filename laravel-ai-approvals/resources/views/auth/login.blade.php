@extends('layouts.app')

@section('title', __('support.auth.title'))

@section('content')
<div class="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
    <form method="post" action="{{ url('/login') }}" class="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        @csrf
        <h1 class="text-lg font-semibold">{{ __('support.auth.title') }}</h1>
        <label class="block text-sm">
            <span class="text-slate-700">{{ __('support.auth.email') }}</span>
            <input name="email" type="email" value="{{ old('email') }}" required autocomplete="username" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200">
        </label>
        <label class="block text-sm">
            <span class="text-slate-700">{{ __('support.auth.password') }}</span>
            <input name="password" type="password" required autocomplete="current-password" class="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200">
        </label>
        @error('email')<p class="text-sm text-red-700" role="alert">{{ $message }}</p>@enderror
        <button class="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">{{ __('support.auth.submit') }}</button>
    </form>

    @if ($demo->isNotEmpty())
        <section class="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 class="font-semibold">{{ __('support.auth.demo_title') }}</h2>
            <p class="text-sm text-amber-900">{{ __('support.auth.demo_hint') }}</p>
            @foreach ($demo as $user)
                <form method="post" action="{{ route('demo-login', $user) }}">
                    @csrf
                    <button class="flex w-full items-center justify-between rounded-md border border-amber-300 bg-white px-3 py-2 text-left text-sm hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-600" data-demo-user="{{ $user->email }}">
                        <span>{{ $user->name }}</span>
                        <span class="text-amber-800">{{ __('support.auth.roles.'.$user->role) }}</span>
                    </button>
                </form>
            @endforeach
        </section>
    @endif
</div>
@endsection
