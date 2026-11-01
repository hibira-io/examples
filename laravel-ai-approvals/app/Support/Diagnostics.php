<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Structured local diagnostics: event name, correlation ids, status and
 * time, one JSON line each in storage/logs/diagnostics.log. Never secrets,
 * keys, conversation text or tool arguments.
 *
 * Events: case_started, approval_requested, approval_decided,
 * agent_resumed, refund_completed, refund_replayed, flow_failed.
 */
class Diagnostics
{
    /** @param  array<string, scalar|null>  $ids */
    public function record(string $event, array $ids, ?string $status = null): void
    {
        try {
            Log::channel('diagnostics')->info($event, [
                'event' => $event,
                'status' => $status,
                'at' => now()->toIso8601ZuluString('millisecond'),
            ] + $ids);
        } catch (Throwable) {
            // Diagnostics never break the flow.
        }
    }
}
