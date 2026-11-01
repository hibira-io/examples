<?php

namespace App\Models;

use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One customer's support conversation about one order.
 *
 * @property string $id
 * @property int $customer_id
 * @property int $order_id
 * @property string|null $conversation_id the laravel/ai conversation
 * @property string $status
 * @property string|null $approval_request_id
 * @property string|null $error
 * @property int $version
 */
class SupportCase extends Model
{
    use HasUlids;

    /** Nothing running; the customer may write. */
    public const IDLE = 'idle';

    /** The agent is working on the customer's message. */
    public const THINKING = 'thinking';

    /** The agent wants to refund and waits for a manager. */
    public const AWAITING_APPROVAL = 'awaiting_approval';

    /** A manager decided; the agent carries on, on the queue. */
    public const RESUMING = 'resuming';

    /** The refund ran and the agent answered. */
    public const COMPLETED = 'completed';

    /** The manager rejected the refund and the agent answered. */
    public const REJECTED = 'rejected';

    /** Something failed; the data is kept and the step can be retried. */
    public const FAILED = 'failed';

    /** Statuses in which the customer may send a new message. */
    public const OPEN_FOR_INPUT = [self::IDLE, self::COMPLETED, self::REJECTED, self::FAILED];

    protected $guarded = [];

    protected $casts = [
        'version' => 'integer',
    ];

    /** @return BelongsTo<User, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<ApprovalRequest, $this> */
    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }

    /** @return HasMany<SupportMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class, 'case_id')->orderBy('id');
    }

    /** @return HasMany<RefundOperation, $this> */
    public function operations(): HasMany
    {
        return $this->hasMany(RefundOperation::class, 'case_id')->orderBy('created_at');
    }

    public function acceptsInput(): bool
    {
        return in_array($this->status, self::OPEN_FOR_INPUT, true);
    }

    public static function channelName(string $id, bool $prefixed = false): string
    {
        return ($prefixed ? 'private-' : '')."support.case.{$id}";
    }
}
