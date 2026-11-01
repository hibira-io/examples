<?php

namespace App\Support;

use App\Ai\Agents\SupportAgent;
use App\Jobs\RunCustomerTurn;
use App\Models\Order;
use App\Models\RefundOperation;
use App\Models\SupportCase;
use App\Models\SupportMessage;
use App\Models\User;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Hibira\FilamentApprovals\Models\ToolCall;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Ai\Approvals\Decisions;
use Laravel\Ai\Contracts\ConversationStore;
use Laravel\Ai\Exceptions\ApprovalMismatchException;
use Laravel\Ai\Models\Conversation;
use Laravel\Ai\Streaming\Events\TextDelta;
use Laravel\Ai\Streaming\Events\ToolApprovalRequest;
use RuntimeException;
use Throwable;

/**
 * Runs the support agent for a case, always on the queue, and keeps the
 * case's business state in step with it.
 *
 * Customer turn: submit() stores the message and queues RunCustomerTurn.
 * The agent looks up the order and asks to refund; the Laravel AI SDK
 * pauses the turn and hibira-io/filament-approvals puts it in the managers'
 * inbox. Their decision resumes the turn on the queue through resume(),
 * which filament-approvals calls (HibiraApprovals::resumeUsing).
 */
class SupportTurns
{
    public function __construct(
        protected CaseFeed $feed,
        protected RefundService $refunds,
        protected Diagnostics $diagnostics,
    ) {}

    /** The customer's open case for an order, made on first visit. */
    public function caseFor(User $customer, Order $order): SupportCase
    {
        if ($order->customer_id !== $customer->getKey()) {
            throw new RuntimeException('Not this customer\'s order.');
        }

        return DB::transaction(function () use ($customer, $order) {
            $existing = SupportCase::query()
                ->where('customer_id', $customer->getKey())
                ->where('order_id', $order->getKey())
                ->latest()
                ->lockForUpdate()
                ->first();

            if ($existing) {
                return $existing;
            }

            // The agent's conversation exists from the start, so the case
            // always knows it and every turn continues the same one.
            $conversationId = app(ConversationStore::class)->storeConversation(
                Conversation::participantType($customer),
                Conversation::participantKey($customer),
                __('support.conversation_title', ['order' => $order->number]),
            );

            $case = SupportCase::query()->create([
                'customer_id' => $customer->getKey(),
                'order_id' => $order->getKey(),
                'conversation_id' => $conversationId,
                'status' => SupportCase::IDLE,
            ]);

            $this->diagnostics->record('case_started', ['case_id' => $case->id]);

            return $case;
        });
    }

    /**
     * Stores the customer's message and queues the agent. Returns null when
     * the case is busy (thinking, waiting on a manager, resuming).
     */
    public function submit(SupportCase $case, string $text): ?SupportMessage
    {
        $message = DB::transaction(function () use ($case, $text) {
            $locked = SupportCase::query()->whereKey($case->getKey())->lockForUpdate()->firstOrFail();

            if (! $locked->acceptsInput()) {
                return null;
            }

            $message = $locked->messages()->create(['role' => SupportMessage::CUSTOMER, 'body' => $text]);

            $this->transition($locked, SupportCase::THINKING, ['error' => null, 'run_id' => (string) Str::uuid7()]);

            RunCustomerTurn::dispatch($locked->id, $message->id)->afterCommit();

            return $message;
        });

        $case->refresh();

        return $message;
    }

    /** Runs on the queue (RunCustomerTurn). */
    public function runCustomerTurn(SupportCase $case, SupportMessage $message): void
    {
        if ($case->status !== SupportCase::THINKING) {
            return;
        }

        $agent = (new SupportAgent)->continue($case->conversation_id, as: $case->customer);

        $text = $this->stream($case, fn () => $agent->stream($message->body));

        DB::transaction(function () use ($case, $text) {
            $locked = SupportCase::query()->whereKey($case->getKey())->lockForUpdate()->firstOrFail();

            if (filled($text)) {
                $locked->messages()->create(['role' => SupportMessage::AGENT, 'body' => $text]);
            }

            $request = $this->pendingRequest($locked);

            if ($request === null) {
                $this->transition($locked, SupportCase::IDLE);

                return;
            }

            foreach ($request->calls as $call) {
                $this->refunds->operationFor($call);
            }

            $this->transition($locked, SupportCase::AWAITING_APPROVAL, ['approval_request_id' => $request->id]);

            $this->diagnostics->record('approval_requested', [
                'case_id' => $locked->id,
                'approval_request_id' => $request->id,
            ], $request->status);
        });
    }

    /**
     * Resumes a paused turn with the managers' decisions. Called by
     * filament-approvals' ResumeAgent job, on the queue; it also runs again
     * when a reviewer chooses "Try again" after a failure.
     */
    public function resume(ApprovalRequest $request, Decisions $decisions, ?object $user): void
    {
        $case = SupportCase::query()->where('conversation_id', $request->conversation_id)->first();

        if ($case === null || ! $user instanceof User || $case->customer_id !== $user->getKey()) {
            throw new RuntimeException('No support case for this approval request.');
        }

        DB::transaction(function () use ($case, $request) {
            $locked = SupportCase::query()->whereKey($case->getKey())->lockForUpdate()->firstOrFail();

            foreach ($request->calls as $call) {
                $this->refunds->recordDecision($call);
            }

            $this->transition($locked, SupportCase::RESUMING, ['approval_request_id' => $request->id, 'error' => null, 'run_id' => (string) Str::uuid7()]);
        });

        $case->refresh();

        $this->diagnostics->record('agent_resumed', ['case_id' => $case->id, 'approval_request_id' => $request->id]);

        $agent = (new SupportAgent)->continue($case->conversation_id, as: $user);

        try {
            $text = $this->stream($case, fn () => $agent->stream($decisions));
        } catch (ApprovalMismatchException $e) {
            // The conversation already holds these tool results: an earlier
            // attempt ran the tool, then failed before the agent answered.
            // Finish the case from what is stored instead of running it again.
            $this->finishFromStored($case, $request);

            throw $e;
        } catch (Throwable $e) {
            $this->fail($case, 'resume_failed');

            throw $e;
        }

        DB::transaction(function () use ($case, $request, $text) {
            $locked = SupportCase::query()->whereKey($case->getKey())->lockForUpdate()->firstOrFail();

            if (filled($text)) {
                $locked->messages()->create(['role' => SupportMessage::AGENT, 'body' => $text]);
            }

            $operations = RefundOperation::query()->where('approval_request_id', $request->id)->get();

            [$status, $error] = match (true) {
                $operations->contains('status', RefundOperation::COMPLETED) => [SupportCase::COMPLETED, null],
                $operations->contains('status', RefundOperation::INVALID) => [SupportCase::FAILED, 'refund_invalid'],
                default => [SupportCase::REJECTED, null],
            };

            $this->transition($locked, $status, ['error' => $error]);
        });
    }

    /** Ends a resumed case from the stored refund operations, with a notice in the chat. */
    protected function finishFromStored(SupportCase $case, ApprovalRequest $request): void
    {
        DB::transaction(function () use ($case, $request) {
            $locked = SupportCase::query()->whereKey($case->getKey())->lockForUpdate()->firstOrFail();
            $operations = RefundOperation::query()->with('refund', 'order')->where('approval_request_id', $request->id)->get();
            $done = $operations->firstWhere('status', RefundOperation::COMPLETED);

            $locked->messages()->create([
                'role' => SupportMessage::NOTICE,
                'body' => $done
                    ? __('support.notice.refunded', ['order' => $done->order->number, 'amount' => Money::format($done->refund->amount, $done->refund->currency), 'reference' => $done->refund->reference])
                    : __('support.notice.not_refunded'),
            ]);

            $this->transition($locked, $done ? SupportCase::COMPLETED : SupportCase::REJECTED, ['error' => null]);
        });
    }

    /** Marks the case failed, keeping everything stored so far. */
    public function fail(SupportCase $case, string $error): void
    {
        DB::transaction(function () use ($case, $error) {
            $locked = SupportCase::query()->whereKey($case->getKey())->lockForUpdate()->first();

            if ($locked === null) {
                return;
            }

            // The turn paused for approval before it failed: it is waiting, not lost.
            if ($locked->status === SupportCase::THINKING && ($request = $this->pendingRequest($locked))) {
                $this->transition($locked, SupportCase::AWAITING_APPROVAL, ['approval_request_id' => $request->id]);

                return;
            }

            $this->transition($locked, SupportCase::FAILED, ['error' => $error]);
        });

        $this->diagnostics->record('flow_failed', ['case_id' => $case->id], $error);
    }

    /**
     * Streams a turn: pushes the text to the customer's browser a few
     * characters at a time (coalesced, so a long answer is a handful of
     * events), and returns the whole text.
     *
     * @param  callable(): iterable<mixed>  $start
     */
    protected function stream(SupportCase $case, callable $start): string
    {
        $runId = (string) $case->run_id;
        $seq = 0;
        $buffer = '';
        $text = '';
        $flushedAt = microtime(true);

        $flush = function () use ($case, $runId, &$seq, &$buffer, &$flushedAt) {
            if ($buffer === '') {
                return;
            }

            $this->feed->delta($case->id, $runId, ++$seq, $buffer);
            $buffer = '';
            $flushedAt = microtime(true);
        };

        foreach ($start() as $event) {
            if ($event instanceof TextDelta) {
                $text .= $event->delta;
                $buffer .= $event->delta;

                if (mb_strlen($buffer) >= 400 || microtime(true) - $flushedAt >= 0.25) {
                    $flush();
                }
            } elseif ($event instanceof ToolApprovalRequest) {
                $flush();
            }
        }

        $flush();

        return trim($text);
    }

    protected function pendingRequest(SupportCase $case): ?ApprovalRequest
    {
        return ApprovalRequest::query()
            ->with('calls')
            ->where('conversation_id', $case->conversation_id)
            ->where('status', ApprovalRequest::PENDING)
            ->latest()
            ->first();
    }

    /** @param  array<string, mixed>  $attributes */
    protected function transition(SupportCase $case, string $status, array $attributes = []): void
    {
        $case->forceFill(['status' => $status, 'version' => $case->version + 1] + $attributes)->save();

        $this->feed->changed($case);
    }

    /** @return array<string, mixed> what the customer's page shows */
    public function snapshot(SupportCase $case): array
    {
        $case->loadMissing('order', 'messages', 'operations', 'approvalRequest.calls');
        $request = $case->approvalRequest;

        return [
            'id' => $case->id,
            'version' => $case->version,
            'status' => $case->status,
            'error' => $case->error,
            'run_id' => $case->run_id,
            'accepts_input' => $case->acceptsInput(),
            'order' => $case->order->toSnapshot(),
            'messages' => $case->messages->map->toSnapshot()->values(),
            'operations' => $case->operations->map->toSnapshot()->values(),
            'approval' => $request === null ? null : [
                'status' => $request->status,
                'decided_by' => $request->decided_by_name,
                'calls' => $request->calls->map(fn (ToolCall $call) => ['decision' => $call->decision])->values(),
            ],
        ];
    }
}
