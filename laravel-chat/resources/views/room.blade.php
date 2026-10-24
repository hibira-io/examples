@extends('layouts.app')

@section('title', '#'.$room)

@section('body')
<div class="mx-auto flex h-screen max-w-5xl flex-col md:flex-row">
    <aside class="flex shrink-0 flex-col gap-6 border-b border-slate-200 p-4 md:w-60 md:border-r md:border-b-0 dark:border-slate-800">
        <div class="flex items-center justify-between">
            <span class="font-semibold">Hibira chat</span>
            <form method="POST" action="{{ route('leave') }}">
                @csrf
                <button class="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white" title="Leave">Leave</button>
            </form>
        </div>
        <nav class="flex gap-1 md:flex-col">
            @foreach ($rooms as $name)
                <a href="{{ route('room', $name) }}"
                   class="rounded-md px-3 py-1.5 {{ $name === $room ? 'bg-indigo-600 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-800' }}">#{{ $name }}</a>
            @endforeach
        </nav>
        <div class="hidden md:block">
            <h2 class="mb-2 text-xs font-semibold uppercase text-slate-500">Here now · <span id="online-count">0</span></h2>
            <ul id="online" class="space-y-1 text-sm"></ul>
        </div>
    </aside>

    <main class="flex min-h-0 flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h1 class="font-semibold">#{{ $room }}</h1>
            <span id="status" class="text-xs text-amber-600">connecting…</span>
        </header>

        <ol id="messages" class="flex-1 space-y-3 overflow-y-auto px-4 py-4"></ol>

        <p id="typing" class="h-5 px-4 text-xs text-slate-500"></p>
        <form id="composer" class="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
            <input id="body" autocomplete="off" maxlength="2000" placeholder="Message #{{ $room }}"
                   class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
            <button class="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500">Send</button>
        </form>
    </main>
</div>

<script>
    window.chat = {{ Js::from($chat) }};
</script>
@endsection
