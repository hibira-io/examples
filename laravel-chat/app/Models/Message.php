<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['room', 'user_id', 'body'])]
class Message extends Model
{
    public const ROOMS = ['general', 'random', 'laravel'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** What the browser renders, for the page and for broadcasts alike. */
    public function toChat(): array
    {
        return [
            'id' => $this->id,
            'body' => $this->body,
            'user' => ['id' => $this->user->id, 'name' => $this->user->name],
            'at' => $this->created_at->toIso8601String(),
        ];
    }
}
