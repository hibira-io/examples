<?php

namespace App\Ai\Agents;

use App\Ai\Tools\IssueRefund;
use App\Ai\Tools\LookupOrders;
use App\Models\User;
use Laravel\Ai\Attributes\MaxSteps;
use Laravel\Ai\Concerns\RemembersConversations;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\Conversational;
use Laravel\Ai\Contracts\HasTools;
use Laravel\Ai\Promptable;
use LogicException;
use Stringable;

/**
 * The support agent. It remembers its conversation (laravel/ai's database
 * store), so a turn paused for approval can be resumed by the queue.
 *
 * The provider is config('ai.default'): the "demo-mock" provider by
 * default (no API key, see App\Ai\Mock\MockSupportGateway), or any
 * Laravel AI SDK provider in Live mode.
 */
#[MaxSteps(6)]
class SupportAgent implements Agent, Conversational, HasTools
{
    use Promptable, RemembersConversations;

    public function instructions(): Stringable|string
    {
        return <<<'TXT'
        You are the customer support agent of a small online shop. Answer in Traditional Chinese (zh-TW), briefly and politely.
        When the customer asks for a refund: call lookup_orders, then call issue_refund for the refundable amount of the order they mean,
        with amount as an integer number of cents and the order's currency, and a short reason for the manager.
        Every refund waits for a manager's approval; never claim a refund happened before the tool result says so.
        After the tool result, tell the customer exactly what happened: the refunded amount, or that the manager declined and why.
        You can only refund through issue_refund. It is a simulated refund in this demo: say so, and don't promise when or how money arrives.
        Write plain text without Markdown; the chat shows it as typed.
        TXT;
    }

    /** Live mode's model (AI_MODEL), or null for the provider's default. */
    public function model(): ?string
    {
        return config('support.model') ?: null;
    }

    public function tools(): iterable
    {
        $customer = $this->conversationParticipant();

        if (! $customer instanceof User) {
            throw new LogicException('The support agent needs the customer as its conversation participant.');
        }

        return [
            new LookupOrders($customer),
            new IssueRefund($customer, $this->currentConversation()),
        ];
    }
}
