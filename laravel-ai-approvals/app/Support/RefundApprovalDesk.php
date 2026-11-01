<?php

namespace App\Support;

use App\Ai\Tools\IssueRefund;
use Filament\Notifications\Notification;
use Hibira\FilamentApprovals\ApprovalDesk;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Hibira\FilamentApprovals\Models\ToolCall;
use Illuminate\Contracts\Auth\Authenticatable;
use InvalidArgumentException;

/**
 * filament-approvals' ApprovalDesk with two refund rules, bound in the
 * container (AppServiceProvider) so the inbox page uses it:
 *
 * - An approve or edit of issue_refund is checked against the order on the
 *   backend (amount, currency, order, what is left to refund) before it is
 *   saved. The tool checks again, under lock, when it runs.
 * - A decision another manager already made can't be overwritten; undo it
 *   first. Combined with the package's locked send(), two managers
 *   deciding at once give exactly one outcome.
 */
class RefundApprovalDesk extends ApprovalDesk
{
    public function decide(ToolCall $call, string $decision, Authenticatable $by, string $name, ?array $arguments = null, ?string $rejection = null): ToolCall
    {
        if (! in_array($decision, ToolCall::DECISIONS, true)) {
            throw new InvalidArgumentException("Unknown decision [{$decision}].");
        }

        if ($decision !== ToolCall::REJECT && $call->tool === IssueRefund::NAME && ($problem = $this->refundProblem($call, $decision === ToolCall::EDIT ? ($arguments ?? []) : $call->arguments))) {
            $this->warn(__('support.inbox.invalid_title'), $problem);

            return $call->refresh();
        }

        $rejection = $decision === ToolCall::REJECT && filled($rejection)
            ? mb_substr(trim($rejection), 0, (int) config('hibira-approvals.reason_characters', 1000))
            : null;

        $me = (string) $by->getAuthIdentifier();

        $updated = ToolCall::query()
            ->whereKey($call->getKey())
            ->whereHas('request', fn ($q) => $q->where('status', ApprovalRequest::PENDING))
            ->where(fn ($q) => $q->whereNull('decision')->orWhere('decided_by', $me))
            ->update([
                'decision' => $decision,
                'edited_arguments' => $decision === ToolCall::EDIT ? json_encode($arguments ?? []) : null,
                'rejection' => $rejection,
                'decided_by' => $me,
                'decided_by_name' => $name,
                'decided_at' => now(),
            ]);

        $call->refresh();

        if ($updated > 0) {
            $this->toInbox($call->request, 'decided', $name);
        } elseif ($call->request->isPending()) {
            $this->warn(__('support.inbox.taken_title'), __('support.inbox.taken_body', ['name' => $call->decided_by_name]));
        }

        return $call;
    }

    /** @param  array<string, mixed>  $arguments */
    protected function refundProblem(ToolCall $call, array $arguments): ?string
    {
        $refunds = app(RefundService::class);
        $operation = $refunds->operationFor($call);

        if ($operation === null) {
            return __('support.invalid.no_case');
        }

        return $refunds->problemWith($operation, $operation->order()->firstOrFail(), $arguments);
    }

    protected function warn(string $title, string $body): void
    {
        if (app()->runningInConsole() && ! app()->runningUnitTests()) {
            return;
        }

        Notification::make()->danger()->title($title)->body($body)->send();
    }
}
