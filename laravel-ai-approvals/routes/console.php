<?php

use App\Ai\Tools\IssueRefund;
use App\Models\Order;
use App\Models\Refund;
use App\Models\SupportCase;
use App\Models\User;
use App\Support\Money;
use App\Support\SupportTurns;
use Database\Seeders\DemoSeeder;
use Hibira\FilamentApprovals\ApprovalDesk;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/*
 * Resets the demo scenario only: the demo order's cases, their approval
 * requests, refund operations, refunds and agent conversations, then seeds
 * the accounts and order again. Other data is left alone; it is not
 * migrate:fresh. Refused in production.
 */
Artisan::command('demo:reset', function () {
    if (app()->environment('production')) {
        $this->error('demo:reset is for the local demo; it does not run in production.');

        return 1;
    }

    DB::transaction(function () {
        $order = Order::query()->where('number', 'DEMO-1042')->first();

        if ($order !== null) {
            $cases = SupportCase::query()->where('order_id', $order->id)->get();
            $conversations = $cases->pluck('conversation_id')->filter()->all();

            // Queued turns for these cases find nothing and stop (RunCustomerTurn, SupportTurns::resume).
            DB::table('refunds')->where('order_id', $order->id)->delete();
            DB::table('refund_operations')->where('order_id', $order->id)->delete();
            ApprovalRequest::query()->whereIn('conversation_id', $conversations)->delete();
            SupportCase::query()->whereIn('id', $cases->pluck('id'))->delete();
            DB::table(config('ai.conversations.tables.messages', 'agent_conversation_messages'))->whereIn('conversation_id', $conversations)->delete();
            DB::table(config('ai.conversations.tables.conversations', 'agent_conversations'))->whereIn('id', $conversations)->delete();
        }

        (new DemoSeeder)->run();
    });

    $this->info('Demo scenario reset: DEMO-1042, USD 49.00 paid, nothing refunded.');
})->purpose('Reset the demo order and its cases, approvals and refunds');

/*
 * Runs the whole flow once without a browser, on the configured provider
 * (Mock or Live): the customer asks, manager A approves with the amount set
 * to --amount, and the agent answers. Uses the demo order, so run
 * demo:reset first. Prints statuses and amounts only.
 */
Artisan::command('demo:smoke {--amount=2900 : Amount in cents manager A approves}', function () {
    if (app()->environment('production')) {
        $this->error('demo:smoke uses the demo data; it does not run in production.');

        return 1;
    }

    $customer = User::query()->where('email', 'customer@demo.test')->firstOrFail();
    $manager = User::query()->where('email', 'manager.a@demo.test')->firstOrFail();
    $order = Order::query()->where('number', 'DEMO-1042')->firstOrFail();
    $turns = app(SupportTurns::class);

    $this->line('provider: '.config('ai.default').(config('support.model') ? ' / '.config('support.model') : ' (default model)'));

    // Run queued work in this process, so no worker is needed for the check.
    config(['queue.default' => 'sync', 'hibira-approvals.queue.connection' => 'sync']);

    $case = $turns->caseFor($customer, $order);
    $turns->submit($case, '我想退掉這筆訂單');
    $case->refresh();
    $this->line("after the customer's message: {$case->status}".($case->error ? " ({$case->error})" : ''));

    $request = $case->approvalRequest()->with('calls')->first();

    if ($request === null) {
        $this->error('The agent did not ask to refund. Its answer: '.$case->messages()->reorder('id', 'desc')->value('body'));

        return 1;
    }

    $call = $request->calls->firstWhere('tool', IssueRefund::NAME);
    $this->line('agent asked: '.json_encode(Arr::only($call->arguments, ['order_number', 'amount', 'currency'])));

    $desk = app(ApprovalDesk::class);
    $desk->decide($call, 'edit', $manager, $manager->name, ['amount' => (int) $this->option('amount')] + $call->arguments);
    $desk->send($request->refresh(), $manager, $manager->name);

    $case->refresh();
    $order->refresh();
    $this->line("after the decision: case {$case->status}, request {$request->refresh()->status}, refunded ".Money::format($order->refunded_amount).', refunds '.Refund::query()->where('order_id', $order->id)->count());
    $this->line('agent: '.$case->messages()->reorder('id', 'desc')->value('body'));

    return $case->status === SupportCase::COMPLETED ? 0 : 1;
})->purpose('Run the refund flow once on the configured AI provider (local check)');

/*
 * Worker health check (compose.yaml): fails when a job has been ready to
 * run for longer than --max-wait seconds, i.e. no worker is taking jobs.
 */
Artisan::command('queue:health {--max-wait=120}', function () {
    $oldest = DB::table(config('queue.connections.database.table', 'jobs'))
        ->whereNull('reserved_at')
        ->where('available_at', '<=', now()->getTimestamp())
        ->min('available_at');

    $waiting = $oldest === null ? 0 : now()->getTimestamp() - (int) $oldest;

    if ($waiting > (int) $this->option('max-wait')) {
        $this->error("A job has waited {$waiting}s.");

        return 1;
    }

    $this->info('ok');

    return 0;
})->purpose('Fail when queued jobs are not being picked up');
