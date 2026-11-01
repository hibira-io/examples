@extends('layouts.app')

@section('title', __('support.auth.forbidden_title'))

@section('content')
<div class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6">
    <h1 class="text-lg font-semibold">{{ __('support.auth.forbidden_title') }}</h1>
    <p class="mt-2 text-slate-600">{{ __('support.auth.forbidden_body') }}</p>
</div>
@endsection
