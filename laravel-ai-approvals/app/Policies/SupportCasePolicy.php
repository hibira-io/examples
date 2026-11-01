<?php

namespace App\Policies;

use App\Models\SupportCase;
use App\Models\User;

class SupportCasePolicy
{
    /** Only the customer who owns the case: its order, messages and refunds. */
    public function view(User $user, SupportCase $case): bool
    {
        return $user->isCustomer() && $case->customer_id === $user->getKey();
    }

    public function message(User $user, SupportCase $case): bool
    {
        return $this->view($user, $case);
    }
}
