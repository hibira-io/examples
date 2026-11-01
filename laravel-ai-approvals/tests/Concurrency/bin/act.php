<?php

/*
 * One actor in a concurrency test, in its own PHP process with its own
 * database connection. Boots the app, waits for the shared start time,
 * acts, and prints the result as JSON.
 *
 *   php act.php <start-at-ms> decide-send <request-id> <email> <approve|reject>
 *   php act.php <start-at-ms> execute <operation-id> <amount>
 */

use App\Models\RefundOperation;
use App\Models\User;
use App\Support\RefundService;
use Hibira\FilamentApprovals\ApprovalDesk;
use Hibira\FilamentApprovals\Models\ApprovalRequest;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../../vendor/autoload.php';

$app = require __DIR__.'/../../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

[, $startAt, $action] = $argv;
$args = array_slice($argv, 3);

// Everything is loaded and connected; now line up with the other actors.
DB::select('select 1');
while ((int) (microtime(true) * 1000) < (int) $startAt) {
    usleep(200);
}

$result = match ($action) {
    'decide-send' => (function () use ($args) {
        [$requestId, $email, $decision] = $args;
        $user = User::query()->where('email', $email)->firstOrFail();
        $desk = app(ApprovalDesk::class);
        $request = ApprovalRequest::query()->with('calls')->findOrFail($requestId);

        // What the inbox's "approve all" / "reject all" does: decide, then send.
        foreach ($request->calls as $call) {
            $desk->decide($call, $decision, $user, $user->name, null, $decision === 'reject' ? "{$user->name} 拒絕" : null);
        }

        return ['sent' => $desk->send($request->refresh(), $user, $user->name)];
    })(),
    'execute' => (function () use ($args) {
        [$operationId, $amount] = $args;

        return json_decode(app(RefundService::class)->execute(
            RefundOperation::query()->findOrFail($operationId),
            ['order_number' => 'DEMO-1042', 'amount' => (int) $amount, 'currency' => 'USD', 'reason' => 'race'],
        ), true);
    })(),
};

echo json_encode($result, JSON_UNESCAPED_UNICODE);
