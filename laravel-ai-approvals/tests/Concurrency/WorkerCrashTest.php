<?php

namespace Tests\Concurrency;

use App\Models\Refund;
use App\Models\RefundOperation;
use App\Models\SupportCase;
use Hibira\FilamentApprovals\ApprovalDesk;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * A real `queue:work` process is killed (SIGKILL) inside the refund, just
 * before or just after its transaction commits. The queue gives the job up,
 * the request shows as failed, a manager retries, and there is exactly one
 * refund either way.
 */
class WorkerCrashTest extends ConcurrencyTestCase
{
    /** @return array<string, array{string, int}> */
    public static function crashPoints(): array
    {
        return [
            'before the commit' => ['refund.before_commit', 0],
            'after the commit' => ['refund.after_commit', 1],
        ];
    }

    #[DataProvider('crashPoints')]
    public function test_a_worker_killed_during_the_refund_loses_nothing_and_refunds_once(string $point, int $refundsAfterCrash): void
    {
        $request = $this->askForRefund();

        // Decide in the inbox; the resume goes to the database queue.
        config(['hibira-approvals.queue.connection' => 'database']);
        $this->inbox($this->managerA())->call('decide', $request->calls->first()->id, 'approve');
        $this->inbox($this->managerA())->call('send', $request->id);
        $this->assertSame(ApprovalRequest::RESUMING, $request->refresh()->status);
        $this->assertSame(1, DB::table('jobs')->count());

        // The worker dies in the middle of the refund.
        $worker = $this->artisanProcess(['queue:work', 'database', '--once', '--tries=1'], ['DEMO_CRASH_AT' => $point, 'DB_QUEUE_RETRY_AFTER' => '1']);
        $this->assertTrue($worker->hasBeenSignaled() && $worker->getTermSignal() === 9, 'the worker was killed: '.$worker->getErrorOutput());
        $this->assertSame($refundsAfterCrash, Refund::query()->count());

        // Nothing is lost: the decision is stored, the request still says resuming.
        $this->assertSame('approve', $request->calls()->first()->decision);
        $this->assertSame(ApprovalRequest::RESUMING, $request->refresh()->status);

        // A restarted worker finds the abandoned job; with one try allowed it
        // is given up, and the app marks the request failed instead of
        // leaving it "resuming" forever.
        sleep(2);
        $this->artisanProcess(['queue:work', 'database', '--once', '--tries=1'], ['DB_QUEUE_RETRY_AFTER' => '1']);
        $this->assertSame(ApprovalRequest::FAILED, $request->refresh()->status);
        $this->assertSame(SupportCase::FAILED, $this->supportCase()->status);
        $this->assertSame('worker_interrupted', $this->supportCase()->error);

        // A manager retries; the operation id makes it safe.
        app(ApprovalDesk::class)->retry($request, 'B');
        $this->artisanProcess(['queue:work', 'database', '--once', '--tries=1']);

        $this->assertSame(1, Refund::query()->count());
        $this->assertSame(4900, $this->order()->refunded_amount);
        $this->assertSame(RefundOperation::COMPLETED, RefundOperation::query()->sole()->status);
        $this->assertSame(SupportCase::COMPLETED, $this->supportCase()->status);
        $this->assertSame(ApprovalRequest::RESUMED, $request->refresh()->status);
    }

    public function test_a_pending_approval_survives_worker_restarts(): void
    {
        $request = $this->askForRefund();

        // Workers come and go; the request waits in the database, not in a process.
        $this->artisanProcess(['queue:work', 'database', '--once', '--stop-when-empty']);
        $this->artisanProcess(['queue:work', 'database', '--once', '--stop-when-empty']);

        $this->assertSame(ApprovalRequest::PENDING, $request->refresh()->status);
        $this->assertSame(SupportCase::AWAITING_APPROVAL, $this->supportCase()->status);
        $this->assertSame(RefundOperation::AWAITING_DECISION, RefundOperation::query()->sole()->status);
    }
}
