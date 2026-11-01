<?php

namespace App\Ai\Mock;

use App\Ai\Tools\IssueRefund;
use App\Ai\Tools\LookupOrders;
use Generator;
use Laravel\Ai\Contracts\Gateway\StepTextGateway;
use Laravel\Ai\Contracts\Providers\TextProvider;
use Laravel\Ai\Gateway\StepContext;
use Laravel\Ai\Gateway\StepResponse;
use Laravel\Ai\Gateway\TextGenerationOptions;
use Laravel\Ai\Messages\Message;
use Laravel\Ai\Messages\ToolResultMessage;
use Laravel\Ai\Messages\UserMessage;
use Laravel\Ai\Responses\Data\FinishReason;
use Laravel\Ai\Responses\Data\Meta;
use Laravel\Ai\Responses\Data\TextUsage;
use Laravel\Ai\Responses\Data\ToolCall;
use Laravel\Ai\Responses\Data\ToolResult;
use Laravel\Ai\Streaming\Events\StreamStart;
use Laravel\Ai\Streaming\Events\TextDelta;
use Laravel\Ai\Streaming\Events\TextEnd;
use Laravel\Ai\Streaming\Events\TextStart;
use Laravel\Ai\Streaming\Events\ToolCall as ToolCallEvent;
use RuntimeException;

use function Laravel\Ai\ulid;

/**
 * Mock mode: the one place where the demo replaces the model.
 *
 * It stands in for the provider's HTTP call only. It reads the real
 * conversation (user message, tool results) and answers with what a model
 * would: tool calls or text. Everything around it is the Laravel AI SDK's
 * real loop: tool validation, the approval pause, the conversation store,
 * resuming with decisions and running the tool. So Mock mode exercises the
 * same database, queue and Hibira paths as Live mode.
 *
 * It is registered as the "demo-mock" provider driver in
 * AppServiceProvider, and used only when AI_PROVIDER=demo-mock.
 */
class MockSupportGateway implements StepTextGateway
{
    public function generateTextStep(
        TextProvider $provider,
        string $model,
        ?string $instructions,
        array $messages,
        array $tools,
        ?array $schema,
        ?TextGenerationOptions $options,
        ?int $timeout,
        StepContext $stepContext,
    ): StepResponse {
        return $this->step($provider, $model, $messages);
    }

    public function generateStreamStep(
        string $invocationId,
        TextProvider $provider,
        string $model,
        ?string $instructions,
        array $messages,
        array $tools,
        ?array $schema,
        ?TextGenerationOptions $options,
        ?int $timeout,
        StepContext $stepContext,
    ): Generator {
        $step = $this->step($provider, $model, $messages);

        yield (new StreamStart(ulid(), $provider->name(), $model, time()))->withInvocationId($invocationId);

        if ($step->text !== '') {
            $messageId = ulid();

            yield (new TextStart(ulid(), $messageId, time()))->withInvocationId($invocationId);

            // A few characters at a time, like a model streaming tokens.
            foreach (mb_str_split($step->text, 4) as $chunk) {
                yield (new TextDelta(ulid(), $messageId, $chunk, time()))->withInvocationId($invocationId);

                if (($delay = (int) config('support.mock.delay_ms')) > 0) {
                    usleep($delay * 1000);
                }
            }

            yield (new TextEnd(ulid(), $messageId, time()))->withInvocationId($invocationId);
        }

        foreach ($step->toolCalls as $toolCall) {
            yield (new ToolCallEvent(ulid(), $toolCall, time()))->withInvocationId($invocationId);
        }

        return $step;
    }

    /** @param  Message[]  $messages */
    protected function step(TextProvider $provider, string $model, array $messages): StepResponse
    {
        if (config('support.mock.fail')) {
            throw new RuntimeException('Mock model failure (DEMO_MOCK_AI_FAILURE=true).');
        }

        $last = end($messages);

        if ($last instanceof ToolResultMessage) {
            $result = $last->toolResults->last();

            if ($result instanceof ToolResult && $result->name === LookupOrders::NAME) {
                return $this->afterLookup($provider, $model, $messages, $result);
            }

            if ($result instanceof ToolResult && $result->name === IssueRefund::NAME) {
                if (config('support.mock.fail_after_refund')) {
                    throw new RuntimeException('Mock model failure after the refund ran (DEMO_MOCK_AI_FAILURE_AFTER_REFUND=true).');
                }

                return $this->text($provider, $model, $this->afterRefund($result));
            }
        }

        $prompt = $last instanceof UserMessage ? $last->content : '';

        if (preg_match('/退|refund/iu', $prompt) === 1) {
            return $this->toolCall($provider, $model, LookupOrders::NAME, []);
        }

        return $this->text($provider, $model, __('support.mock.greeting'));
    }

    /** @param  Message[]  $messages */
    protected function afterLookup(TextProvider $provider, string $model, array $messages, ToolResult $lookup): StepResponse
    {
        $orders = json_decode((string) $lookup->result, true)['orders'] ?? [];
        $prompt = collect($messages)->whereInstanceOf(UserMessage::class)->last()?->content ?? '';

        // The order the customer named, or their only refundable one.
        $order = collect($orders)->first(fn (array $order) => str_contains($prompt, $order['order_number']))
            ?? collect($orders)->first(fn (array $order) => $order['refundable_amount'] > 0);

        if ($order === null || $order['refundable_amount'] <= 0) {
            return $this->text($provider, $model, __('support.mock.nothing_to_refund'));
        }

        return $this->toolCall($provider, $model, IssueRefund::NAME, [
            'order_number' => $order['order_number'],
            'amount' => $order['refundable_amount'],
            'currency' => $order['currency'],
            'reason' => __('support.mock.refund_reason', ['amount' => $order['refundable']]),
        ], __('support.mock.asking_manager', ['order' => $order['order_number'], 'amount' => $order['refundable']]));
    }

    protected function afterRefund(ToolResult $result): string
    {
        if ($result->denied) {
            $reason = (string) $result->result;

            return $reason === '' || $reason === 'The user rejected this tool call.'
                ? __('support.mock.rejected_no_reason')
                : __('support.mock.rejected', ['reason' => $reason]);
        }

        $data = json_decode((string) $result->result, true);

        return match ($data['status'] ?? null) {
            'refunded' => __('support.mock.refunded', ['order' => $data['order_number'], 'amount' => $data['amount_display'], 'reference' => $data['reference']]),
            'invalid' => __('support.mock.invalid', ['error' => $data['error'] ?? '']),
            default => __('support.mock.unknown'),
        };
    }

    /** @param  array<string, mixed>  $arguments */
    protected function toolCall(TextProvider $provider, string $model, string $tool, array $arguments, string $text = ''): StepResponse
    {
        return new StepResponse(
            $text,
            [new ToolCall('call_'.strtolower(ulid()), $tool, $arguments)],
            FinishReason::ToolCalls,
            new TextUsage,
            new Meta($provider->name(), $model),
        );
    }

    protected function text(TextProvider $provider, string $model, string $text): StepResponse
    {
        return new StepResponse($text, [], FinishReason::Stop, new TextUsage, new Meta($provider->name(), $model));
    }
}
