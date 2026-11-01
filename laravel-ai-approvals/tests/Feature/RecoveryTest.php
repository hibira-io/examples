<?php

namespace Tests\Feature;

use App\Models\Refund;
use App\Models\RefundOperation;
use App\Models\SupportCase;
use App\Models\SupportMessage;
use App\Support\RefundService;
use App\Support\SupportTurns;
use Hibira\FilamentApprovals\ApprovalDesk;
use Hibira\FilamentApprovals\Jobs\ResumeAgent;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Retries, redeliveries and failures never lose a decision or refund twice. */
class RecoveryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    protected function approve(ApprovalRequest $request): void
    {
        $this->inbox($this->managerA())->call('decide', $request->calls->first()->id, 'approve');
        $this->inbox($this->managerA())->call('send', $request->id);
    }

    public function test_running_the_tool_again_returns_the_same_refund(): void
    {
        $this->askForRefund();
        $operation = RefundOperation::query()->sole();
        $arguments = ['order_number' => 'DEMO-1042', 'amount' => 4900, 'currency' => 'USD', 'reason' => 'x'];

        $first = app(RefundService::class)->execute($operation, $arguments);
        $again = app(RefundService::class)->execute($operation->refresh(), $arguments);
        // Even with different arguments, the operation is done.
        $changed = app(RefundService::class)->execute($operation->refresh(), ['amount' => 100] + $arguments);

        $this->assertSame($first, $again);
        $this->assertSame($first, $changed);
        $this->assertSame(1, Refund::query()->count());
        $this->assertSame(4900, $this->order()->refunded_amount);
    }

    public function test_a_redelivered_resume_job_does_not_refund_again(): void
    {
        $request = $this->askForRefund();
        $this->approve($request);
        $this->assertSame(1, Refund::query()->count());

        // The same job delivered again, and even forced back to "resuming".
        ResumeAgent::dispatchSync($request->id);
        $request->refresh()->forceFill(['status' => ApprovalRequest::RESUMING])->save();
        ResumeAgent::dispatchSync($request->id);

        $this->assertSame(1, Refund::query()->count());
        $this->assertSame(4900, $this->order()->refunded_amount);
    }

    public function test_sending_twice_resumes_once(): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();
        $this->inbox($this->managerA())->call('decide', $call->id, 'approve');

        $first = app(ApprovalDesk::class)->send($request, $this->managerA(), 'A');
        $second = app(ApprovalDesk::class)->send($request->refresh(), $this->managerB(), 'B');

        $this->assertTrue($first);
        $this->assertFalse($second);
        $this->assertSame(1, Refund::query()->count());
    }

    public function test_a_second_manager_cannot_overwrite_a_decision(): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();

        $this->inbox($this->managerA())->call('decide', $call->id, 'approve');
        $this->inbox($this->managerB())->call('decide', $call->id, 'reject', null, 'B 想拒絕')->assertNotified();

        $call->refresh();
        $this->assertSame('approve', $call->decision);
        $this->assertSame((string) $this->managerA()->id, $call->decided_by);
    }

    public function test_a_duplicate_message_while_the_case_is_busy_is_refused_with_the_current_state(): void
    {
        $this->askForRefund();
        $case = $this->supportCase();

        $this->actingAs($this->customer())
            ->postJson(route('cases.messages', $case), ['body' => '我想退掉這筆訂單'])
            ->assertStatus(409)
            ->assertJsonPath('status', SupportCase::AWAITING_APPROVAL);

        $this->assertSame(1, ApprovalRequest::query()->count());
        $this->assertSame(1, $case->messages()->where('role', SupportMessage::CUSTOMER)->count());
    }

    public function test_a_model_failure_is_shown_and_the_message_is_kept(): void
    {
        config(['support.mock.fail' => true]);
        $case = app(SupportTurns::class)->caseFor($this->customer(), $this->order());

        $this->actingAs($this->customer())->postJson(route('cases.messages', $case), ['body' => '我想退掉這筆訂單'])->assertStatus(202);

        $state = $this->actingAs($this->customer())->getJson(route('cases.show', $case))->json();
        $this->assertSame(SupportCase::FAILED, $state['status']);
        $this->assertSame('agent_failed', $state['error']);
        $this->assertTrue($state['accepts_input']);
        $this->assertSame('我想退掉這筆訂單', $state['messages'][0]['body']);

        config(['support.mock.fail' => false]);
        $this->askForRefund();
    }

    public function test_a_failure_after_the_refund_is_retried_without_refunding_twice(): void
    {
        $request = $this->askForRefund();
        config(['support.mock.fail_after_refund' => true]);
        $this->approve($request);

        $request->refresh();
        $this->assertSame(ApprovalRequest::FAILED, $request->status);
        $this->assertSame(1, Refund::query()->count(), 'the refund committed before the model failed');
        $this->assertSame(SupportCase::FAILED, $this->supportCase()->status);
        $this->assertSame('resume_failed', $this->supportCase()->error);

        config(['support.mock.fail_after_refund' => false]);
        $this->inbox($this->managerB())->call('retry', $request->id);

        $this->assertSame(1, Refund::query()->count());
        $this->assertSame(4900, $this->order()->refunded_amount);
        $this->assertSame(SupportCase::COMPLETED, $this->supportCase()->status);
        $this->assertStringContainsString('USD 49.00', $this->supportCase()->messages()->reorder('id', 'desc')->value('body'));
    }

    public function test_hibira_being_down_loses_nothing(): void
    {
        $this->hibira->failing = true;

        $request = $this->askForRefund();
        $this->approve($request);

        $this->assertSame(1, Refund::query()->count());
        $state = $this->actingAs($this->customer())->getJson(route('cases.show', $this->supportCase()))->json();
        $this->assertSame(SupportCase::COMPLETED, $state['status']);
        $this->assertSame('USD 49.00', $state['order']['refunded']);
        $this->assertSame('completed', $state['operations'][0]['status']);
    }

    public function test_the_snapshot_restores_the_page_after_a_reload(): void
    {
        $request = $this->askForRefund();
        $before = $this->actingAs($this->customer())->getJson(route('cases.show', $this->supportCase()))->json();
        $this->assertSame('awaiting_approval', $before['status']);
        $this->assertFalse($before['accepts_input']);

        $this->inbox($this->managerA())->call('decide', $request->calls->first()->id, 'edit', json_encode(['order_number' => 'DEMO-1042', 'amount' => 2900, 'currency' => 'USD', 'reason' => 'x']));
        $this->inbox($this->managerA())->call('send', $request->id);

        $after = $this->actingAs($this->customer())->getJson(route('cases.show', $this->supportCase()))->json();
        $this->assertGreaterThan($before['version'], $after['version']);
        $this->assertSame('completed', $after['status']);
        $this->assertSame('USD 29.00', $after['order']['refunded']);
        $this->assertSame('USD 20.00', $after['order']['refundable']);
        $this->assertSame('USD 49.00', $after['operations'][0]['requested']);
        $this->assertSame('USD 29.00', $after['operations'][0]['final']);
        $this->assertSame('王經理（主管 A）', $after['operations'][0]['decided_by']);
        $this->assertSame('agent', end($after['messages'])['role']);

        // The page renders the same state on a full reload.
        $this->actingAs($this->customer())->get(route('support.order', $this->order()))
            ->assertOk()
            ->assertSee('DEMO-1042');
    }

    public function test_events_carry_a_growing_version_and_no_order_data(): void
    {
        $request = $this->askForRefund();
        $this->approve($request);

        $events = $this->hibira->on(SupportCase::channelName($this->supportCase()->id, prefixed: true), 'case.updated');
        $versions = array_map(fn ($e) => $e['data']['v'], $events);

        $this->assertSame($versions, array_values(array_unique($versions)));
        $sorted = $versions;
        sort($sorted);
        $this->assertSame($sorted, $versions);
        $this->assertSame(['v', 'status'], array_keys($events[0]['data']));

        $inbox = $this->hibira->on('private-hibira-approvals.admin.inbox');
        foreach ($inbox as $event) {
            $this->assertArrayNotHasKey('arguments', $event['data'], 'the inbox fetches arguments through the panel');
        }
    }
}
