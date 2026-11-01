<?php

namespace App\Models;

use App\Support\Money;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Hibira\FilamentApprovals\Models\ToolCall;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * A logical refund the agent asked for. The id is the idempotency key:
 * every retry of the same tool call finds this row and at most one refund
 * can point at it.
 *
 * @property string $id
 * @property string $case_id
 * @property int $order_id
 * @property string $approval_request_id
 * @property int $approval_tool_call_id
 * @property string $tool_call_id
 * @property string $currency
 * @property int $requested_amount
 * @property int|null $final_amount
 * @property string $status
 * @property string|null $decision
 * @property string|null $decided_by
 * @property string|null $decided_by_name
 * @property Carbon|null $decided_at
 * @property string|null $note
 * @property Carbon|null $completed_at
 */
class RefundOperation extends Model
{
    use HasUuids;

    public const AWAITING_DECISION = 'awaiting_decision';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    public const COMPLETED = 'completed';

    /** Approved with arguments the backend refused; no refund was made. */
    public const INVALID = 'invalid';

    protected $guarded = [];

    protected $casts = [
        'requested_amount' => 'integer',
        'final_amount' => 'integer',
        'decided_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<SupportCase, $this> */
    public function supportCase(): BelongsTo
    {
        return $this->belongsTo(SupportCase::class, 'case_id');
    }

    /** @return BelongsTo<ApprovalRequest, $this> */
    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }

    /** @return BelongsTo<ToolCall, $this> */
    public function approvalToolCall(): BelongsTo
    {
        return $this->belongsTo(ToolCall::class, 'approval_tool_call_id');
    }

    /** @return HasOne<Refund, $this> */
    public function refund(): HasOne
    {
        return $this->hasOne(Refund::class, 'operation_id');
    }

    /** @return array<string, mixed> */
    public function toSnapshot(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'requested' => Money::format($this->requested_amount, $this->currency),
            'final' => $this->final_amount === null ? null : Money::format($this->final_amount, $this->currency),
            'decided_by' => $this->decided_by_name,
            'note' => $this->status === self::REJECTED ? $this->note : null,
        ];
    }
}
