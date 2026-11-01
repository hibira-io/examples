<?php

namespace App\Support;

use App\Ai\Tools\IssueRefund;
use App\Models\Order;
use App\Models\Refund;
use App\Models\RefundOperation;
use App\Models\SupportCase;
use App\Models\User;
use Hibira\FilamentApprovals\Models\ToolCall;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The demo's simulated refunds.
 *
 * Idempotency: a RefundOperation row is created once per refund tool call
 * (unique on the approval tool call) and its id is the operation id. Every
 * execution of that tool call, whether an HTTP retry, a queue redelivery or
 * a reviewer's "try again", locks that row, and refunds.operation_id is
 * unique, so one operation gives at most one refund. The order row is
 * locked too, so two operations can't both refund the last dollars.
 *
 * This is a database-only refund. A real payment API also needs its own
 * idempotency key (send the operation id) and a reconciliation of the
 * provider's result: a local transaction can't make a third-party call
 * exactly-once.
 */
class RefundService
{
    public function __construct(protected Diagnostics $diagnostics) {}

    /**
     * The operation for a paused refund call, created the first time.
     * Null when the call doesn't belong to a support case.
     */
    public function operationFor(ToolCall $call): ?RefundOperation
    {
        if ($call->tool !== IssueRefund::NAME) {
            return null;
        }

        if ($existing = RefundOperation::query()->where('approval_tool_call_id', $call->getKey())->first()) {
            return $existing;
        }

        $request = $call->request;
        $case = $request?->conversation_id === null
            ? null
            : SupportCase::query()->where('conversation_id', $request->conversation_id)->first();

        if ($case === null) {
            return null;
        }

        $order = $case->order;
        $amount = $call->arguments['amount'] ?? null;

        try {
            return RefundOperation::query()->create([
                'case_id' => $case->id,
                'order_id' => $order->id,
                'approval_request_id' => $request->id,
                'approval_tool_call_id' => $call->getKey(),
                'tool_call_id' => $call->tool_call_id,
                'currency' => $order->currency,
                'requested_amount' => is_int($amount) && $amount > 0 ? $amount : 0,
            ]);
        } catch (UniqueConstraintViolationException) {
            // Someone else created it a moment ago.
            return RefundOperation::query()->where('approval_tool_call_id', $call->getKey())->firstOrFail();
        }
    }

    /**
     * Why these arguments can't be refunded, or null when they can. Used
     * when a manager decides and again, under lock, when the tool runs.
     *
     * @param  array<string, mixed>  $arguments
     */
    public function problemWith(RefundOperation $operation, Order $order, array $arguments): ?string
    {
        $amount = $arguments['amount'] ?? null;
        $currency = $arguments['currency'] ?? null;

        return match (true) {
            ($arguments['order_number'] ?? null) !== $order->number || $operation->order_id !== $order->id => __('support.invalid.order'),
            ! is_string($currency) || strtoupper($currency) !== Money::CURRENCY || $order->currency !== Money::CURRENCY => __('support.invalid.currency'),
            ! is_int($amount) => __('support.invalid.not_integer'),
            $amount <= 0 => __('support.invalid.not_positive'),
            $amount > $order->refundable() => __('support.invalid.too_much', ['refundable' => Money::format($order->refundable(), $order->currency)]),
            default => null,
        };
    }

    /** Copies a manager's decision onto the operation, for the audit trail. */
    public function recordDecision(ToolCall $call): ?RefundOperation
    {
        $operation = $this->operationFor($call);

        if ($operation === null || $call->decision === null || $operation->status === RefundOperation::COMPLETED) {
            return $operation;
        }

        $arguments = $call->decision === ToolCall::EDIT ? ($call->edited_arguments ?? []) : $call->arguments;
        $amount = $arguments['amount'] ?? null;

        $operation->forceFill([
            'decision' => $call->decision,
            'decided_by' => $call->decided_by,
            'decided_by_name' => $call->decided_by_name,
            'decided_at' => $call->decided_at,
            'status' => $call->decision === ToolCall::REJECT ? RefundOperation::REJECTED : RefundOperation::APPROVED,
            'final_amount' => $call->decision === ToolCall::REJECT ? null : (is_int($amount) ? $amount : null),
            'note' => $call->decision === ToolCall::REJECT ? $call->rejection : null,
        ])->save();

        $this->diagnostics->record('approval_decided', [
            'case_id' => $operation->case_id,
            'approval_request_id' => $operation->approval_request_id,
            'operation_id' => $operation->id,
        ], $call->decision);

        return $operation;
    }

    /**
     * Runs from the issue_refund tool, on the queue, with the arguments the
     * manager approved. Returns the tool result the model reads.
     *
     * @param  array<string, mixed>  $arguments
     */
    public function executeFromTool(User $customer, ?string $conversationId, string $toolCallId, array $arguments): string
    {
        $call = $conversationId === null ? null : ToolCall::query()
            ->with('request')
            ->where('tool_call_id', $toolCallId)
            ->whereHas('request', fn ($q) => $q->where('conversation_id', $conversationId))
            ->first();

        $operation = $call === null ? null : $this->operationFor($call);

        if ($operation === null || $operation->supportCase->customer_id !== $customer->getKey()) {
            return $this->result(['status' => 'invalid', 'error' => __('support.invalid.no_approval')]);
        }

        return $this->execute($operation, $arguments);
    }

    /**
     * Refunds once per operation. Safe to call again: a completed operation
     * returns its stored result.
     *
     * @param  array<string, mixed>  $arguments
     */
    public function execute(RefundOperation $operation, array $arguments): string
    {
        [$result, $fresh] = DB::transaction(function () use ($operation, $arguments) {
            /** @var RefundOperation $locked */
            $locked = RefundOperation::query()->whereKey($operation->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === RefundOperation::COMPLETED) {
                return [$this->completedResult($locked), false];
            }

            if ($locked->status === RefundOperation::REJECTED) {
                return [$this->result(['status' => 'invalid', 'error' => __('support.invalid.rejected')]), false];
            }

            /** @var Order $order */
            $order = Order::query()->whereKey($locked->order_id)->lockForUpdate()->firstOrFail();

            if ($problem = $this->problemWith($locked, $order, $arguments)) {
                $locked->forceFill(['status' => RefundOperation::INVALID, 'note' => $problem])->save();

                return [$this->result(['status' => 'invalid', 'error' => $problem]), false];
            }

            $amount = (int) $arguments['amount'];

            Refund::query()->create([
                'operation_id' => $locked->id,
                'order_id' => $order->id,
                'currency' => $order->currency,
                'amount' => $amount,
                'reference' => 'RF-'.Str::upper(Str::substr(str_replace('-', '', $locked->id), 0, 12)),
            ]);

            $order->increment('refunded_amount', $amount);

            $locked->forceFill([
                'status' => RefundOperation::COMPLETED,
                'final_amount' => $amount,
                'completed_at' => now(),
            ])->save();

            FaultInjection::hit('refund.before_commit');

            return [$this->completedResult($locked->refresh()), true];
        });

        FaultInjection::hit('refund.after_commit');

        $this->diagnostics->record($fresh ? 'refund_completed' : 'refund_replayed', [
            'case_id' => $operation->case_id,
            'operation_id' => $operation->id,
        ], json_decode($result, true)['status'] ?? null);

        return $result;
    }

    protected function completedResult(RefundOperation $operation): string
    {
        $refund = $operation->refund()->firstOrFail();

        return $this->result([
            'status' => 'refunded',
            'operation_id' => $operation->id,
            'order_number' => $operation->order->number,
            'amount' => $refund->amount,
            'currency' => $refund->currency,
            'amount_display' => Money::format($refund->amount, $refund->currency),
            'reference' => $refund->reference,
        ]);
    }

    /** @param  array<string, mixed>  $data */
    protected function result(array $data): string
    {
        return (string) json_encode($data, JSON_UNESCAPED_UNICODE);
    }
}
