<?php

namespace App\Ai\Tools;

use App\Models\Order;
use App\Models\User;
use App\Support\Money;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;

/**
 * Reads the signed-in customer's own orders. The customer comes from the
 * agent's conversation participant, never from the model's arguments.
 */
class LookupOrders implements Tool
{
    public const NAME = 'lookup_orders';

    public function __construct(protected User $customer) {}

    public function name(): string
    {
        return self::NAME;
    }

    public function description(): Stringable|string
    {
        return 'List the current customer\'s orders with paid, refunded and refundable amounts in integer minor units (cents).';
    }

    public function handle(Request $request): Stringable|string
    {
        $orders = Order::query()
            ->where('customer_id', $this->customer->getKey())
            ->orderBy('id')
            ->get()
            ->map(fn (Order $order) => [
                'order_number' => $order->number,
                'description' => $order->description,
                'currency' => $order->currency,
                'paid_amount' => $order->paid_amount,
                'refunded_amount' => $order->refunded_amount,
                'refundable_amount' => $order->refundable(),
                'refundable' => Money::format($order->refundable(), $order->currency),
            ]);

        return (string) json_encode(['orders' => $orders], JSON_UNESCAPED_UNICODE);
    }

    public function schema(JsonSchema $schema): array
    {
        return [];
    }
}
