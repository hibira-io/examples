<?php

namespace Tests\Feature;

use App\Models\Refund;
use App\Models\RefundOperation;
use App\Support\RefundService;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Hibira\FilamentApprovals\Models\ToolCall;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** The backend checks amounts, currency and order, whatever the inbox or the model sends. */
class RefundValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedDemo();
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function invalidArguments(): array
    {
        $valid = ['order_number' => 'DEMO-1042', 'amount' => 2900, 'currency' => 'USD', 'reason' => 'x'];

        return [
            'negative' => [['amount' => -100] + $valid],
            'zero' => [['amount' => 0] + $valid],
            'not an integer' => [['amount' => 29.5] + $valid],
            'a numeric string' => [['amount' => '2900'] + $valid],
            'more than paid' => [['amount' => 4901] + $valid],
            'wrong currency' => [['currency' => 'EUR'] + $valid],
            'another order' => [['order_number' => 'DEMO-9999'] + $valid],
            'missing amount' => [array_diff_key($valid, ['amount' => true])],
        ];
    }

    /** @param  array<string, mixed>  $arguments */
    #[DataProvider('invalidArguments')]
    public function test_an_invalid_edit_is_not_saved_and_nothing_is_refunded(array $arguments): void
    {
        $request = $this->askForRefund();
        $call = $request->calls->first();

        $this->inbox($this->managerA())
            ->call('decide', $call->id, 'edit', json_encode($arguments))
            ->assertNotified();

        $this->assertNull($call->refresh()->decision);

        $this->inbox($this->managerA())->call('send', $request->id);

        $this->assertSame(ApprovalRequest::PENDING, $request->refresh()->status, 'nothing to send without a valid decision');
        $this->assertSame(0, Refund::query()->count());
    }

    /** @param  array<string, mixed>  $arguments */
    #[DataProvider('invalidArguments')]
    public function test_the_refund_itself_refuses_invalid_arguments(array $arguments): void
    {
        $this->askForRefund();
        $operation = RefundOperation::query()->sole();

        $result = json_decode(app(RefundService::class)->execute($operation, $arguments), true);

        $this->assertSame('invalid', $result['status']);
        $this->assertSame(0, Refund::query()->count());
        $this->assertSame(0, $this->order()->refunded_amount);
        $this->assertSame(RefundOperation::INVALID, $operation->refresh()->status);
    }

    public function test_two_operations_cannot_refund_more_than_was_paid(): void
    {
        $this->askForRefund();
        $first = RefundOperation::query()->sole();
        $valid = ['order_number' => 'DEMO-1042', 'currency' => 'USD', 'reason' => 'x'];

        $this->assertSame('refunded', json_decode(app(RefundService::class)->execute($first, ['amount' => 4000] + $valid), true)['status']);

        // A second logical operation on the same order, for more than is left.
        $second = $first->replicate(['id']);
        $second->forceFill(['approval_tool_call_id' => $this->secondCall($first)->id, 'status' => RefundOperation::APPROVED])->save();

        $result = json_decode(app(RefundService::class)->execute($second, ['amount' => 1000] + $valid), true);

        $this->assertSame('invalid', $result['status']);
        $this->assertSame(4000, $this->order()->refunded_amount);
        $this->assertSame(1, Refund::query()->count());
    }

    protected function secondCall(RefundOperation $operation): ToolCall
    {
        $call = $operation->approvalToolCall;

        return $call->request->calls()->create([
            'tool_call_id' => 'call_second',
            'tool' => $call->tool,
            'arguments' => $call->arguments,
        ]);
    }
}
