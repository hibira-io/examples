<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\SupportCase;
use App\Support\SupportTurns;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SupportController
{
    public function __construct(protected SupportTurns $turns) {}

    /** The customer's first order with something left to refund, or their first order. */
    public function index(Request $request): RedirectResponse|View
    {
        abort_unless($request->user()->isCustomer(), 403);

        $order = $request->user()->orders()->orderBy('id')->first();

        abort_if($order === null, 404, __('support.no_orders'));

        return redirect()->route('support.order', $order);
    }

    public function show(Request $request, Order $order): View
    {
        // Another customer's order is "not found", not "forbidden".
        abort_unless($request->user()->isCustomer() && $order->customer_id === $request->user()->getKey(), 404);

        $case = $this->turns->caseFor($request->user(), $order);

        return view('support.show', [
            'case' => $case,
            'snapshot' => $this->turns->snapshot($case),
            'stateUrl' => route('cases.show', $case),
            'messageUrl' => route('cases.messages', $case),
            'channel' => SupportCase::channelName($case->id),
        ]);
    }

    /** The case as stored: what the page shows after a reload or a reconnect. */
    public function state(Request $request, SupportCase $case): JsonResponse
    {
        $this->authorizeView($request, $case);

        return response()->json($this->turns->snapshot($case))->header('Cache-Control', 'no-store');
    }

    public function message(Request $request, SupportCase $case): JsonResponse
    {
        $this->authorizeView($request, $case);

        $text = trim((string) $request->validate([
            'body' => ['required', 'string', 'max:1000'],
        ])['body']);

        $message = $this->turns->submit($case, $text);

        // Busy (thinking, waiting on a manager, resuming): say so with the current state.
        if ($message === null) {
            return response()->json(['error' => __('support.busy')] + $this->turns->snapshot($case->refresh()), 409);
        }

        return response()->json($this->turns->snapshot($case->refresh()), 202);
    }

    protected function authorizeView(Request $request, SupportCase $case): void
    {
        abort_unless($request->user()->can('view', $case), 404);
    }
}
