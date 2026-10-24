@extends('layouts.app')

@section('body')
<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
    <div>
        <h1 class="text-3xl font-semibold">Hibira chat</h1>
        <p class="mt-2 text-slate-500 dark:text-slate-400">
            A Laravel chat on Hibira: rooms are presence channels, messages are broadcast events and
            typing indicators are client events.
        </p>
    </div>
    <form method="POST" action="{{ route('join') }}" class="flex gap-2">
        @csrf
        <input name="name" required maxlength="40" autofocus placeholder="Your name"
               class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <button class="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500">Join</button>
    </form>
    @error('name')<p class="text-sm text-red-600">{{ $message }}</p>@enderror
    <p class="text-sm text-slate-500 dark:text-slate-400">Open a second browser window and join with another name to chat with yourself.</p>
</main>
@endsection
