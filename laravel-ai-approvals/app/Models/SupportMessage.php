<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What the customer sees in the chat: their messages and the agent's
 * finished answers. The agent's full history (tool calls included) stays
 * in laravel/ai's conversation tables.
 *
 * @property int $id
 * @property string $case_id
 * @property string $role customer, agent or notice
 * @property string $body
 */
class SupportMessage extends Model
{
    public const CUSTOMER = 'customer';

    public const AGENT = 'agent';

    public const NOTICE = 'notice';

    protected $guarded = [];

    /** @return BelongsTo<SupportCase, $this> */
    public function supportCase(): BelongsTo
    {
        return $this->belongsTo(SupportCase::class, 'case_id');
    }

    /** @return array<string, mixed> */
    public function toSnapshot(): array
    {
        return [
            'id' => $this->id,
            'role' => $this->role,
            'body' => $this->body,
            'at' => $this->created_at?->toIso8601String(),
        ];
    }
}
