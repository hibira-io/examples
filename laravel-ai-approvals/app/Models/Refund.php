<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A simulated refund. No money moves: this row is the whole refund.
 *
 * @property int $id
 * @property string $operation_id
 * @property int $order_id
 * @property string $currency
 * @property int $amount
 * @property string $reference
 */
class Refund extends Model
{
    protected $guarded = [];

    protected $casts = [
        'amount' => 'integer',
    ];

    /** @return BelongsTo<RefundOperation, $this> */
    public function operation(): BelongsTo
    {
        return $this->belongsTo(RefundOperation::class, 'operation_id');
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
