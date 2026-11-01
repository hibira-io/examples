<?php

namespace App\Jobs;

use App\Models\SupportCase;
use App\Models\SupportMessage;
use App\Support\SupportTurns;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Runs the agent on a customer's message.
 *
 * One attempt: running a turn twice would send the message to the model
 * twice. When it fails (or the worker dies and the job is given up), the
 * case shows as failed and the customer can send again; a turn that had
 * already paused for approval stays waiting for the managers.
 */
class RunCustomerTurn implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 120;

    public function __construct(public string $caseId, public int $messageId) {}

    public function handle(SupportTurns $turns): void
    {
        $case = SupportCase::query()->find($this->caseId);
        $message = SupportMessage::query()->find($this->messageId);

        // The case was reset or removed meanwhile: nothing to do.
        if ($case === null || $message === null || $message->case_id !== $case->id) {
            return;
        }

        try {
            $turns->runCustomerTurn($case, $message);
        } catch (Throwable $e) {
            report($e);
            $turns->fail($case, 'agent_failed');
        }
    }

    public function failed(?Throwable $e): void
    {
        if ($case = SupportCase::query()->find($this->caseId)) {
            app(SupportTurns::class)->fail($case, 'worker_interrupted');
        }
    }
}
