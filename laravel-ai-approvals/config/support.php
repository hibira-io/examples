<?php

return [

    /*
    | Demo mode: one-click sign-in as the seeded demo users on the sign-in
    | page. For a local demo only; it is refused when APP_ENV=production.
    */

    'demo_mode' => (bool) env('DEMO_MODE', false),

    /*
    | Live mode only: the model for the provider in AI_PROVIDER. Leave empty
    | to use the Laravel AI SDK's default model for that provider.
    */

    'model' => env('AI_MODEL'),

    'mock' => [
        // Pause between streamed chunks, so the streaming is visible.
        'delay_ms' => (int) env('DEMO_MOCK_AI_DELAY_MS', 60),
        // Make every mock model call fail, to see the failure path.
        'fail' => (bool) env('DEMO_MOCK_AI_FAILURE', false),
        // Fail only the model call after the refund ran: the refund is
        // committed, the agent's answer is not. Shows a safe retry.
        'fail_after_refund' => (bool) env('DEMO_MOCK_AI_FAILURE_AFTER_REFUND', false),
    ],

];
