@php use App\Support\Money; @endphp
<div
    x-data
    x-init="
        const listen = () => window.Echo && (window.Echo.private(@js($inbox)).listen('.approval', () => $wire.$refresh()), true)
        if (! listen()) window.addEventListener('EchoLoaded', listen, { once: true })
    "
    style="margin-bottom: 1rem"
>
    @if ($operations->isNotEmpty())
        <x-filament::section :heading="__('support.admin.context_heading')" :description="__('support.admin.context_description')" compact>
            <div style="display: grid; gap: .5rem">
                @foreach ($operations as $operation)
                    <div style="display: flex; flex-wrap: wrap; gap: .25rem 1.25rem; font-size: .875rem">
                        <strong style="font-family: ui-monospace, monospace">{{ $operation->order->number }}</strong>
                        <span>{{ $operation->order->customer->name }}</span>
                        <span>{{ __('support.admin.paid') }} {{ Money::format($operation->order->paid_amount) }}</span>
                        <span>{{ __('support.admin.refunded') }} {{ Money::format($operation->order->refunded_amount) }}</span>
                        <span>{{ __('support.admin.refundable') }} <strong>{{ Money::format($operation->order->refundable()) }}</strong></span>
                        <span>{{ __('support.admin.requested') }} {{ Money::format($operation->requested_amount) }}</span>
                        <span style="opacity: .7">{{ __('support.admin.amount_hint') }}</span>
                    </div>
                @endforeach
            </div>
        </x-filament::section>
    @endif
</div>
