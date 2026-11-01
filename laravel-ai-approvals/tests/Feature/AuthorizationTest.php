<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Refund;
use App\Models\SupportCase;
use App\Models\User;
use App\Support\SupportTurns;
use Hibira\FilamentApprovals\HibiraApprovalsPlugin;
use Hibira\FilamentApprovals\Models\ToolCall;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Every way in checks the user: pages, JSON, Livewire calls and Hibira channels. */
class AuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    protected function otherCustomer(): User
    {
        return User::query()->create(['name' => 'Other', 'email' => 'other@demo.test', 'password' => 'x', 'role' => User::CUSTOMER]);
    }

    public function test_another_customer_cannot_read_or_write_the_case(): void
    {
        $this->askForRefund();
        $case = $this->supportCase();
        $other = $this->otherCustomer();

        $this->actingAs($other)->get(route('support.order', $this->order()))->assertNotFound();
        $this->actingAs($other)->getJson(route('cases.show', $case))->assertNotFound();
        $this->actingAs($other)->postJson(route('cases.messages', $case), ['body' => '退款'])->assertNotFound();
    }

    public function test_managers_and_users_without_a_role_have_no_customer_pages(): void
    {
        $case = app(SupportTurns::class)->caseFor($this->customer(), $this->order());

        foreach ([$this->managerA(), $this->outsider()] as $user) {
            $this->actingAs($user)->getJson(route('cases.show', $case))->assertNotFound();
            $this->actingAs($user)->get(route('support'))->assertForbidden();
        }

        $this->get('/logout');
        auth()->logout();
        $this->getJson(route('cases.show', $case))->assertUnauthorized();
    }

    public function test_only_managers_get_into_the_panel_and_the_inbox(): void
    {
        foreach ([$this->customer(), $this->outsider()] as $user) {
            $this->actingAs($user)->get('/admin/ai-approvals')->assertForbidden();
        }

        $this->actingAs($this->managerA())->get('/admin/ai-approvals')->assertOk();
        $this->actingAs($this->managerA())->get('/admin/refund-operations')->assertOk();
    }

    public function test_a_user_without_the_approver_role_cannot_decide_even_by_calling_the_endpoint(): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();

        // Forging the inbox's Livewire calls: the page refuses to mount at all.
        $this->inbox($this->customer())->assertForbidden();
        $this->inbox($this->outsider())->assertForbidden();

        // And the plugin's authorization holds per request too.
        $this->assertFalse(HibiraApprovalsPlugin::get()->canReview($this->outsider(), $request));

        $this->assertNull($call->refresh()->decision);
        $this->assertSame(0, Refund::query()->count());
    }

    public function test_hibira_channels_are_authorized_per_user(): void
    {
        $this->askForRefund();
        $case = $this->supportCase();
        $caseChannel = SupportCase::channelName($case->id, prefixed: true);

        $auth = fn (User $user, string $channel) => $this->actingAs($user)->post('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => $channel,
        ]);

        $auth($this->customer(), $caseChannel)->assertOk()->assertJsonStructure(['auth']);
        $auth($this->otherCustomer(), $caseChannel)->assertForbidden();
        $auth($this->managerA(), $caseChannel)->assertForbidden();
        $auth($this->outsider(), $caseChannel)->assertForbidden();

        $inbox = 'private-hibira-approvals.admin.inbox';
        $auth($this->managerA(), $inbox)->assertOk();
        $auth($this->customer(), $inbox)->assertForbidden();
        $auth($this->outsider(), $inbox)->assertForbidden();

        $reviewers = 'presence-hibira-approvals.admin.reviewers';
        $auth($this->managerB(), $reviewers)->assertOk()->assertJsonStructure(['auth', 'channel_data']);
        $auth($this->customer(), $reviewers)->assertForbidden();
    }

    public function test_the_agent_only_sees_the_customers_own_orders(): void
    {
        $other = $this->otherCustomer();
        Order::query()->create(['number' => 'OTHER-1', 'customer_id' => $other->id, 'description' => 'x', 'currency' => 'USD', 'paid_amount' => 9900]);

        $request = $this->askForRefund('我想退 OTHER-1 這筆訂單');

        // The mock model can only pick from what lookup_orders returned: the customer's own.
        $this->assertSame('DEMO-1042', $request->calls->first()->arguments['order_number']);
    }

    public function test_an_edit_cannot_move_the_refund_to_another_customers_order(): void
    {
        $other = $this->otherCustomer();
        Order::query()->create(['number' => 'OTHER-1', 'customer_id' => $other->id, 'description' => 'x', 'currency' => 'USD', 'paid_amount' => 9900]);
        $request = $this->askForRefund();
        $call = $request->calls->first();

        $this->inbox($this->managerA())->call('decide', $call->id, 'edit', json_encode(['order_number' => 'OTHER-1', 'amount' => 100, 'currency' => 'USD', 'reason' => 'x']));

        $this->assertNull($call->refresh()->decision);
        $this->assertNotSame(ToolCall::EDIT, $call->decision);
        $this->assertSame(0, Refund::query()->count());
    }
}
