@extends('layouts.app')

@section('title', __('support.page.title'))

@section('content')
<script>
    window.supportPage = @js([
        'snapshot' => $snapshot,
        'stateUrl' => $stateUrl,
        'messageUrl' => $messageUrl,
        'channel' => $channel,
        'strings' => trans('support'),
        // Public values only: the app key and host. The secret stays on the server.
        'hibira' => [
            'key' => (string) config('hibira.key'),
            'host' => (string) config('hibira.host'),
            'port' => (int) config('hibira.port'),
            'scheme' => (string) config('hibira.scheme'),
        ],
    ]);
</script>

<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
    <h1 class="text-xl font-semibold">{{ __('support.page.title') }}</h1>
    <span id="connection" role="status" aria-live="polite" class="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">{{ __('support.connection.connecting') }}</span>
</div>

<div class="grid gap-6 md:grid-cols-[18rem_1fr]">
    <aside class="space-y-4">
        <section class="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="order-heading">
            <h2 id="order-heading" class="text-sm font-medium text-slate-500">{{ __('support.page.order') }}</h2>
            <p class="mt-1 font-mono text-lg font-semibold" id="order-number"></p>
            <p class="text-sm text-slate-600" id="order-description"></p>
            <dl class="mt-3 grid grid-cols-2 gap-y-1 text-sm">
                <dt class="text-slate-500">{{ __('support.page.paid') }}</dt><dd class="text-right tabular-nums" id="order-paid"></dd>
                <dt class="text-slate-500">{{ __('support.page.refunded') }}</dt><dd class="text-right tabular-nums" id="order-refunded"></dd>
                <dt class="text-slate-500">{{ __('support.page.refundable') }}</dt><dd class="text-right font-semibold tabular-nums" id="order-refundable"></dd>
            </dl>
        </section>
        <section class="rounded-xl border border-slate-200 bg-white p-4" aria-labelledby="refunds-heading">
            <h2 id="refunds-heading" class="text-sm font-medium text-slate-500">{{ __('support.page.refunds') }}</h2>
            <ul id="operations" class="mt-2 space-y-2 text-sm"></ul>
        </section>
    </aside>

    <section class="flex min-h-[28rem] flex-col rounded-xl border border-slate-200 bg-white" aria-labelledby="chat-heading">
        <h2 id="chat-heading" class="sr-only">{{ __('support.page.chat') }}</h2>
        <div id="case-status" role="status" aria-live="polite" class="border-b border-slate-200 px-4 py-3 text-sm"></div>
        <ol id="messages" class="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite"></ol>
        <form id="composer" class="flex gap-2 border-t border-slate-200 p-3">
            <label for="body" class="sr-only">{{ __('support.page.chat') }}</label>
            <textarea id="body" name="body" rows="2" maxlength="1000" required placeholder="{{ __('support.page.placeholder') }}" class="min-w-0 flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"></textarea>
            <button id="send" class="self-end rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300">{{ __('support.page.send') }}</button>
        </form>
    </section>
</div>
@endsection
