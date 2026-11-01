<?php

namespace App\Livewire;

use App\Models\RefundOperation;
use App\Models\User;
use Hibira\FilamentApprovals\HibiraApprovalsPlugin;
use Illuminate\Contracts\View\View;
use Livewire\Component;

/**
 * Above the AI approvals inbox: the refunds waiting on a decision, with
 * the order's paid, refunded and refundable amounts, so a manager can
 * judge the agent's request. Re-reads whenever the inbox hears from Hibira.
 */
class RefundContext extends Component
{
    public string $inbox = '';

    public function mount(): void
    {
        $this->inbox = HibiraApprovalsPlugin::inboxChannel(filament()->getCurrentPanel()->getId());
    }

    public function render(): View
    {
        $user = auth()->user();

        $operations = $user instanceof User && $user->isApprover()
            ? RefundOperation::query()
                ->with(['order.customer', 'approvalRequest'])
                ->whereIn('status', [RefundOperation::AWAITING_DECISION, RefundOperation::APPROVED])
                ->latest()
                ->limit(5)
                ->get()
            : collect();

        return view('livewire.refund-context', ['operations' => $operations]);
    }
}
