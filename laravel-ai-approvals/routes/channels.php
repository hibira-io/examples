<?php

use App\Models\SupportCase;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// The customer's case: status changes and the agent's streamed answer.
// Only the customer who owns it may subscribe. The managers' inbox
// channels are registered by hibira-io/filament-approvals.
Broadcast::channel('support.case.{case}', function (User $user, string $case) {
    $model = SupportCase::query()->find($case);

    return $model !== null && $user->can('view', $model);
});
