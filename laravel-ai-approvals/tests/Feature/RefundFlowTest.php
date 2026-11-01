<?php

namespace Tests\Feature;

use App\Models\Refund;
use App\Models\RefundOperation;
use App\Models\SupportCase;
use App\Models\SupportMessage;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Hibira\FilamentApprovals\Models\ToolCall;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The whole flow in Mock mode: the SDK's real loop, approval pause,
 * filament-approvals inbox, queued resume and the refund, on PostgreSQL.
 * Hibira is recorded instead of sent (FakeHibira).
 */
class RefundFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    public function test_the_agent_asks_to_refund_the_whole_order_and_waits_for_a_manager(): void
    {
        $request = $this->askForRefund();

        $this->assertSame(ApprovalRequest::PENDING, $request->status);
        $this->assertCount(1, $request->calls);
        $call = $request->calls->first();
        $this->assertSame('issue_refund', $call->tool);
        $this->assertSame(['order_number' => 'DEMO-1042', 'amount' => 4900, 'currency' => 'USD'], array_intersect_key($call->arguments, array_flip(['order_number', 'amount', 'currency'])));

        $operation = RefundOperation::query()->where('approval_tool_call_id', $call->id)->sole();
        $this->assertSame(RefundOperation::AWAITING_DECISION, $operation->status);
        $this->assertSame(4900, $operation->requested_amount);

        $this->assertSame(0, Refund::query()->count());
        $this->assertSame(0, $this->order()->refunded_amount);

        // The managers' inbox heard about it, and the customer's page too.
        $this->assertNotEmpty($this->hibira->on('private-hibira-approvals.admin.inbox', 'approval'));
        $this->assertNotEmpty($this->hibira->on(SupportCase::channelName($this->supportCase()->id, prefixed: true), 'case.updated'));

        // The customer sees the agent's message that it is waiting.
        $this->assertStringContainsString('主管審批', $this->supportCase()->messages()->where('role', SupportMessage::AGENT)->reorder('id', 'desc')->value('body'));
    }

    public function test_approving_refunds_the_full_amount_once(): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();

        $this->inbox($this->managerA())->call('decide', $call->id, 'approve');
        $this->inbox($this->managerA())->call('send', $request->id);

        $request->refresh();
        $this->assertSame(ApprovalRequest::RESUMED, $request->status);

        $refund = Refund::query()->sole();
        $this->assertSame(4900, $refund->amount);
        $this->assertSame('USD', $refund->currency);
        $this->assertSame(4900, $this->order()->refunded_amount);

        $operation = RefundOperation::query()->sole();
        $this->assertSame(RefundOperation::COMPLETED, $operation->status);
        $this->assertSame(4900, $operation->final_amount);
        $this->assertSame((string) $this->managerA()->id, $operation->decided_by);
        $this->assertSame($operation->id, $refund->operation_id);

        $case = $this->supportCase();
        $this->assertSame(SupportCase::COMPLETED, $case->status);
        $this->assertStringContainsString('USD 49.00', $case->messages()->reorder('id', 'desc')->value('body'));
    }

    public function test_a_manager_can_lower_the_amount_and_both_amounts_are_kept(): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();
        $edited = ['order_number' => 'DEMO-1042', 'amount' => 2900, 'currency' => 'USD', 'reason' => '部分退款'];

        $this->inbox($this->managerB())->call('decide', $call->id, 'edit', json_encode($edited));
        $this->inbox($this->managerB())->call('send', $request->id);

        $this->assertSame(2900, Refund::query()->sole()->amount);
        $this->assertSame(2900, $this->order()->refunded_amount);

        $call->refresh();
        $this->assertSame(4900, $call->arguments['amount'], 'the agent\'s original arguments are kept');
        $this->assertSame(2900, $call->edited_arguments['amount']);
        $this->assertSame(ToolCall::EDIT, $call->decision);

        $operation = RefundOperation::query()->sole();
        $this->assertSame(4900, $operation->requested_amount);
        $this->assertSame(2900, $operation->final_amount);
        $this->assertSame('陳主任（主管 B）', $operation->decided_by_name);
        $this->assertNotNull($operation->decided_at);

        $this->assertStringContainsString('USD 29.00', $this->supportCase()->messages()->reorder('id', 'desc')->value('body'));
    }

    public function test_rejecting_makes_no_refund_and_the_agent_tells_the_reason(): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();

        $this->inbox($this->managerA())->call('decide', $call->id, 'reject', null, '已超過 30 天退貨期限');
        $this->inbox($this->managerA())->call('send', $request->id);

        $this->assertSame(0, Refund::query()->count());
        $this->assertSame(0, $this->order()->refunded_amount);

        $operation = RefundOperation::query()->sole();
        $this->assertSame(RefundOperation::REJECTED, $operation->status);
        $this->assertSame('已超過 30 天退貨期限', $operation->note);

        $case = $this->supportCase();
        $this->assertSame(SupportCase::REJECTED, $case->status);
        $this->assertStringContainsString('已超過 30 天退貨期限', $case->messages()->reorder('id', 'desc')->value('body'));
        $this->assertSame(ApprovalRequest::RESUMED, $request->refresh()->status);
    }

    public function test_the_customer_can_ask_again_after_a_partial_refund_and_only_the_rest_is_refundable(): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();
        $this->inbox($this->managerA())->call('decide', $call->id, 'edit', json_encode(['order_number' => 'DEMO-1042', 'amount' => 2900, 'currency' => 'USD', 'reason' => '部分']));
        $this->inbox($this->managerA())->call('send', $request->id);

        $second = $this->askForRefund('剩下的也想退');
        $this->assertSame(2000, $second->calls->first()->arguments['amount']);
    }
}
