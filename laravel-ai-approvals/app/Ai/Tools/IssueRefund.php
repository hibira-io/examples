<?php

namespace App\Ai\Tools;

use App\Models\User;
use App\Support\RefundService;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Approvals\Approval;
use Laravel\Ai\Concerns\InteractsWithApprovals;
use Laravel\Ai\Contracts\Approvable;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

/**
 * The simulated refund. Every call pauses for a manager (the Laravel AI
 * SDK's own tool approval); the arguments a manager approved, or edited,
 * are validated again by RefundService before anything is written.
 */
class IssueRefund implements Approvable, Tool
{
    use InteractsWithApprovals;

    public const NAME = 'issue_refund';

    public function __construct(protected User $customer, protected ?string $conversationId) {}

    public function name(): string
    {
        return self::NAME;
    }

    public function description(): Stringable|string
    {
        return 'Refund (part of) one of the current customer\'s orders. amount is an integer in minor units (4900 = USD 49.00). Always needs a manager\'s approval; tell the customer it is waiting.';
    }

    protected function needsApproval(Request $request): Approval|bool
    {
        return Approval::required(__('support.approval_reason'));
    }

    public function handle(Request $request): Stringable|string
    {
        return app(RefundService::class)->executeFromTool(
            customer: $this->customer,
            conversationId: $this->conversationId,
            toolCallId: (string) $request->toolCallId(),
            arguments: $request->all(),
        );
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'order_number' => $schema->string()->description('The order number, such as DEMO-1042.')->required(),
            'amount' => $schema->integer()->description('Amount to refund in minor units (cents).')->required(),
            'currency' => $schema->string()->description('ISO currency code; must be the order\'s currency.')->required(),
            'reason' => $schema->string()->description('Why the customer should get this refund, for the manager.')->required(),
        ];
    }
}
