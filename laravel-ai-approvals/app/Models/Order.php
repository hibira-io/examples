<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $number
 * @property int $customer_id
 * @property string $description
 * @property string $currency
 * @property int $paid_amount minor units
 * @property int $refunded_amount minor units
 */
class Order extends Model
{
    protected $guarded = [];

    protected $casts = [
        'paid_amount' => 'integer',
        'refunded_amount' => 'integer',
    ];

    /** @return BelongsTo<User, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /** @return HasMany<Refund, $this> */
    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class);
    }

    public function refundable(): int
    {
        return $this->paid_amount - $this->refunded_amount;
    }

    /** @return array<string, mixed> */
    public function toSnapshot(): array
    {
        return [
            'number' => $this->number,
            'description' => $this->description,
            'currency' => $this->currency,
            'paid' => Money::format($this->paid_amount, $this->currency),
            'refunded' => Money::format($this->refunded_amount, $this->currency),
            'refundable' => Money::format($this->refundable(), $this->currency),
            'paid_amount' => $this->paid_amount,
            'refunded_amount' => $this->refunded_amount,
        ];
    }
}
