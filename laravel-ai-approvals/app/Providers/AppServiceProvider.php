<?php

namespace App\Providers;

use App\Ai\Mock\MockSupportGateway;
use App\Models\SupportCase;
use App\Policies\SupportCasePolicy;
use App\Support\RefundApprovalDesk;
use App\Support\SupportTurns;
use Hibira\FilamentApprovals\ApprovalDesk;
use Hibira\FilamentApprovals\HibiraApprovals;
use Hibira\FilamentApprovals\Jobs\ResumeAgent;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;
use Laravel\Ai\Ai;
use Laravel\Ai\Approvals\Decisions;
use Laravel\Ai\Providers\OpenAiCompatibleProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // The inbox resolves the desk from the container: add the refund rules.
        $this->app->singleton(ApprovalDesk::class, RefundApprovalDesk::class);
    }

    public function boot(): void
    {
        Gate::policy(SupportCase::class, SupportCasePolicy::class);

        // Mock mode: a provider whose only difference is the model's output.
        Ai::extend('demo-mock', fn ($app, array $config) => (new OpenAiCompatibleProvider($config, $app['events']))
            ->useTextGateway(new MockSupportGateway));

        // filament-approvals resumes decided turns on the queue; the case's
        // business state is updated around the agent run.
        HibiraApprovals::resumeUsing(function (ApprovalRequest $request, Decisions $decisions, ?object $user) {
            app(SupportTurns::class)->resume($request, $decisions, $user);
        });

        // ResumeAgent makes one attempt. If its worker dies mid-run the queue
        // gives the job up; show the request as failed so a manager can retry
        // (the refund operation id makes the retry safe) instead of leaving it
        // "resuming" forever.
        Queue::failing(function (JobFailed $event) {
            if ($event->job->resolveName() !== ResumeAgent::class) {
                return;
            }

            try {
                $command = unserialize($event->job->payload()['data']['command'] ?? '');
                $request = $command instanceof ResumeAgent ? ApprovalRequest::query()->find($command->requestId) : null;

                if ($request !== null && $request->status === ApprovalRequest::RESUMING) {
                    app(ApprovalDesk::class)->finish($request, ApprovalRequest::FAILED, __('support.inbox.worker_interrupted'));

                    if ($case = SupportCase::query()->where('conversation_id', $request->conversation_id)->first()) {
                        app(SupportTurns::class)->fail($case, 'worker_interrupted');
                    }
                }
            } catch (Throwable $e) {
                report($e);
            }
        });
    }
}
