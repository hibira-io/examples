<?php

namespace App\Support;

use App\Models\SupportCase;
use Hibira\Laravel\Hibira;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Tells the customer's browser that its case changed, over Hibira.
 *
 * The events only say "version N exists" (and carry streamed text while
 * the agent writes); the browser then fetches the case from the backend.
 * So a failed or lost event never loses anything: the data is in the
 * database first, and the browser reads it again on reconnect.
 */
class CaseFeed
{
    public function __construct(protected Hibira $hibira) {}

    public function changed(SupportCase $case): void
    {
        $this->send($case->id, 'case.updated', [
            'v' => $case->version,
            'status' => $case->status,
        ]);
    }

    /** A piece of the agent's answer while it streams. */
    public function delta(string $caseId, string $runId, int $seq, string $text): void
    {
        $this->send($caseId, 'agent.delta', ['run' => $runId, 'seq' => $seq, 'text' => $text], afterCommit: false);
    }

    /** @param  array<string, mixed>  $data */
    protected function send(string $caseId, string $event, array $data, bool $afterCommit = true): void
    {
        $trigger = function () use ($caseId, $event, $data) {
            try {
                $this->hibira->realtime()->trigger(SupportCase::channelName($caseId, prefixed: true), $event, $data);
            } catch (Throwable $e) {
                report($e);
            }
        };

        $afterCommit ? DB::afterCommit($trigger) : $trigger();
    }
}
