<?php

namespace Tests\Concurrency;

use App\Models\Refund;
use App\Models\RefundOperation;
use App\Models\SupportCase;
use Hibira\FilamentApprovals\Models\ApprovalRequest;

class ConcurrentDecisionsTest extends ConcurrencyTestCase
{
    public function test_two_managers_deciding_differently_at_once_give_exactly_one_outcome(): void
    {
        $request = $this->askForRefund();

        $results = $this->race([
            ['decide-send', $request->id, 'manager.a@demo.test', 'approve'],
            ['decide-send', $request->id, 'manager.b@demo.test', 'reject'],
        ]);

        // Exactly one send moved the request on.
        $this->assertSame(1, collect($results)->where('sent', true)->count(), json_encode($results));

        $request->refresh()->load('calls');
        $call = $request->calls->first();
        $this->assertSame(ApprovalRequest::RESUMED, $request->status);
        $this->assertContains($call->decision, ['approve', 'reject']);

        // The outcome matches the one decision that was stored.
        $refunds = Refund::query()->count();
        $operation = RefundOperation::query()->sole();
        if ($call->decision === 'approve') {
            $this->assertSame(1, $refunds);
            $this->assertSame(4900, $this->order()->refunded_amount);
            $this->assertSame(RefundOperation::COMPLETED, $operation->status);
            $this->assertSame(SupportCase::COMPLETED, $this->supportCase()->status);
        } else {
            $this->assertSame(0, $refunds);
            $this->assertSame(0, $this->order()->refunded_amount);
            $this->assertSame(RefundOperation::REJECTED, $operation->status);
            $this->assertSame(SupportCase::REJECTED, $this->supportCase()->status);
        }
        $this->assertSame($call->decided_by, $operation->decided_by, 'the audit trail names the manager whose decision ran');
    }

    public function test_the_same_refund_run_four_times_at_once_refunds_once(): void
    {
        $this->askForRefund();
        $operation = RefundOperation::query()->sole();

        $results = $this->race(array_fill(0, 4, ['execute', $operation->id, '4900']));

        $this->assertSame(['refunded'], array_values(array_unique(array_column($results, 'status'))));
        $this->assertCount(1, array_unique(array_column($results, 'reference')));
        $this->assertSame(1, Refund::query()->count());
        $this->assertSame(4900, $this->order()->refunded_amount);
    }

    public function test_two_refunds_racing_for_the_last_dollars_cannot_both_win(): void
    {
        $this->askForRefund();
        $first = RefundOperation::query()->sole();
        $call = $first->approvalToolCall;
        $secondCall = $call->request->calls()->create(['tool_call_id' => 'call_second', 'tool' => $call->tool, 'arguments' => $call->arguments]);
        $second = $first->replicate(['id']);
        $second->forceFill(['approval_tool_call_id' => $secondCall->id])->save();

        $results = $this->race([
            ['execute', $first->id, '4000'],
            ['execute', $second->id, '4000'],
        ]);

        $this->assertEqualsCanonicalizing(['refunded', 'invalid'], array_column($results, 'status'));
        $this->assertSame(1, Refund::query()->count());
        $this->assertSame(4000, $this->order()->refunded_amount);
    }
}
