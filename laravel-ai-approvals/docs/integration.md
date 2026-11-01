# Add AI approvals to your Laravel app

This guide splits the example into two parts:

- **The required integration:** what any project needs if it builds agents with the Laravel AI SDK and wants people to approve tool calls.
- **This demo's business logic:** orders, refunds and the support page. These are only an illustration; swap in your own.

> 中文摘要在最後：[中文摘要](#中文摘要)。

Requirements:

- PHP 8.3+
- Laravel 12 or 13
- Filament 3.3, 4 or 5
- A Hibira app ([hibira.io/portal](https://hibira.io/portal))

## A. Required integration

### 1. Install the packages

```sh
composer require hibira-io/filament-approvals laravel/ai
php artisan vendor:publish --provider="Laravel\Ai\AiServiceProvider"   # config/ai.php and the conversation tables
php artisan migrate                                                    # also creates the hibira_approval_* tables
```

Add the Hibira settings to `.env`, then run `php artisan hibira:check`. `php artisan hibira:install` can add the settings for you.

```dotenv
BROADCAST_CONNECTION=hibira
HIBIRA_APP_ID=
HIBIRA_APP_KEY=
HIBIRA_APP_SECRET=
```

### 2. Make the tool ask first: `Approvable`

This is a Laravel AI SDK feature. Example: [app/Ai/Tools/IssueRefund.php](../app/Ai/Tools/IssueRefund.php).

```php
class IssueRefund implements Approvable, Tool
{
    use InteractsWithApprovals;

    protected function needsApproval(Request $request): Approval|bool
    {
        return Approval::required('所有退款都需要主管審批。'); // "Every refund needs a manager's approval."
    }
    // description(), schema(), handle()
}
```

`handle()` runs **after the approval**, on the queue worker, with the arguments the manager approved or edited. Validate them again against your backend data there; don't trust the arguments themselves.

### 3. Let the agent remember the conversation: `RemembersConversations`

To resume a paused turn, the agent has to use the SDK's conversation memory. Example: [app/Ai/Agents/SupportAgent.php](../app/Ai/Agents/SupportAgent.php).

```php
class SupportAgent implements Agent, Conversational, HasTools
{
    use Promptable, RemembersConversations;
}

// Every turn continues the same conversation, as the same user
(new SupportAgent)->continue($conversationId, as: $user)->stream($text);
```

### 4. Add the inbox to a Filament panel

Example: [app/Providers/Filament/AdminPanelProvider.php](../app/Providers/Filament/AdminPanelProvider.php).

```php
->plugins([
    HibiraPlugin::make()->connectionStatus(),
    HibiraApprovalsPlugin::make()
        ->authorize(fn (User $user) => $user->isApprover())   // who may see and decide; also used for Hibira channel auth
        ->approvers(fn () => User::where('role', 'approver')->get()),  // who gets push notifications
])
```

`authorize()` protects the page, every decision, and the Hibira private and presence channels. It doesn't just hide buttons.

### 5. Run a queue worker

```sh
php artisan queue:work
```

When a manager sends a decision, the package's `ResumeAgent` job resumes the agent on the queue. Long-running agents rely on the worker, not on the WebSocket. Serverless execution time limits don't go away because you use Hibira.

That is the whole human approval loop:
1. The agent pauses.
2. The request shows up live in the inbox.
3. A manager decides.
4. The queue resumes the agent.

## B. Optional extension points

These are the package extension points this demo uses. None of them needs changes to `vendor/`.

| Need | How | Where in the demo |
|---|---|---|
| Update your own business state on resume, or stream on your own channels | `HibiraApprovals::resumeUsing(fn ($request, $decisions, $user) => ...)` | `AppServiceProvider` → `SupportTurns::resume()` |
| Validate arguments against backend data at decision time, and stop a second manager overwriting a decision | Bind a subclass of `ApprovalDesk` in the container | [app/Support/RefundApprovalDesk.php](../app/Support/RefundApprovalDesk.php) |
| Don't leave a request stuck on "resuming" when the worker dies | Listen for `JobFailed` and mark the `ResumeAgent` request failed so a manager can retry | `AppServiceProvider::boot()` |
| Show business context next to the inbox | A Filament render hook scoped to the `Approvals` page | [app/Livewire/RefundContext.php](../app/Livewire/RefundContext.php) |
| Test without a model | A custom provider driver (`Ai::extend()`) that replaces only the model output | [app/Ai/Mock/MockSupportGateway.php](../app/Ai/Mock/MockSupportGateway.php) |

## C. This demo's business logic (replace with yours)

- The `orders`, `support_cases`, `support_messages`, `refund_operations` and `refunds` tables and their models.
- [app/Support/RefundService.php](../app/Support/RefundService.php): the simulated refund. Amounts are always integer minor units (4900 = USD 49.00). Idempotency works like this:
  - Each refund tool call gets a `refund_operations` row when it pauses for approval. Its UUID is the **logical operation ID**. `approval_tool_call_id` is unique, so a retry always finds the same row.
  - Execution locks the operation and the order with `SELECT … FOR UPDATE` inside a transaction. `refunds.operation_id` is unique, and a CHECK constraint stops refunds from going over the paid amount.
  - Running a completed operation again returns the stored result and doesn't refund again.
  - **With a real payment provider**, pass the operation ID as the provider's idempotency key and reconcile against what the provider reports. A local database transaction can't make a third-party API call exactly-once.
- [app/Support/SupportTurns.php](../app/Support/SupportTurns.php): the support case state machine and each agent turn.
- [resources/js/support.js](../resources/js/support.js): the customer page.
- `routes/channels.php`: `private-support.case.{id}` is authorized only for the case's customer.

## Live updates and recovery on the customer page

This is how the demo does it, and the pattern we recommend:

1. **The database is the source of truth.** Each state change is written to the database first and bumps `version`. The Hibira event goes out only after the commit.
2. **Events only say "there is a new version":** `case.updated {v, status}`. When the browser sees a newer version than its own, it calls `GET /cases/{id}` for a snapshot. Old and duplicate events are ignored naturally, and a failed event never loses a decision.
3. **Streamed text is numbered:** `agent.delta {run, seq, text}`.
   - When the numbers are in order, the text is appended.
   - When a number is missing, the page shows that the content is incomplete and resyncing. It doesn't append text from after the gap.
   - When the turn ends, the page takes the stored full answer from the snapshot.
4. **A reconnect always refetches the snapshot.** The page never relies on which events it happened to receive.

Hibira's Channel History (rewind) is an optional feature on paid plans, with these limits:

- Each channel keeps at most the last 100 events, within time and size limits.
- Client events aren't stored.
- A replay can return `complete: false`.

This demo doesn't depend on it. If you turn it on to cover short disconnects, still go back to the backend for the state when it returns `complete: false`.

## Known upstream limitations

While building this we found the following places where the packages could improve. The demo already handles each one with the extension points above, so you don't need to wait for a package release.

| Package | Today | Smallest suggested fix | How to verify |
|---|---|---|---|
| hibira-io/filament-approvals 0.1.1 | `ApprovalDesk::decide()` can overwrite a decision another reviewer just made. The inbox's approve-all / reject-all runs decide and send as two steps, so when two managers click at once the one sent may be the other's decision | `decide()` updates only calls that are undecided or decided by the same user, and reports a conflict for the rest; `decideAll` decides and sends in one locked transaction | Two processes running decideAll at once (the demo's `tests/Concurrency/ConcurrentDecisionsTest.php`) |
| hibira-io/filament-approvals 0.1.1 | No hook to validate edited arguments, so invalid arguments are only caught when the tool runs | `HibiraApprovals::validateUsing(fn (ToolCall $call, array $arguments): ?string)`, returning an error string at decision time | The demo's `RefundValidationTest` |
| hibira-io/filament-approvals 0.1.1 | `ResumeAgent` has no `failed()`, so a killed worker leaves the request on resuming | Add `failed()` that marks requests still resuming as failed | The demo's `WorkerCrashTest` |
| hibira-io/laravel | The AI bridge (`AgentChannel`) is in 0.2, but hibira-io/filament 0.2 still requires hibira-io/laravel ^0.1, so installing it with filament-approvals only gets 0.1.2 | Widen hibira-io/filament to `^0.1\|^0.2` | `composer require hibira-io/filament-approvals hibira-io/laravel:^0.2` resolves |

## 中文摘要

**必需的整合（共五步）**
1. 安裝 `hibira-io/filament-approvals` 和 `laravel/ai`。
2. 工具實作 `Approvable`，讓它先問人。
3. Agent 使用 `RemembersConversations`，暫停後才能接續。
4. 在 Filament 面板加上 `HibiraApprovalsPlugin`，並用 `authorize()` 保護頁面、每個決定與頻道。
5. 執行 `queue:work`。

**範例額外用到的擴充點**
- `resumeUsing`、`ApprovalDesk` 子類別、`JobFailed` 監聽、render hook、Mock provider。
- 全部都不需要修改 `vendor/`。

**範例自己的業務**
- 訂單、退款和客服頁面只是示範，換成你自己的就好。
- 退款的冪等靠三件事：後端產生的操作 ID、unique 限制、以及交易內的列鎖。

**客戶頁同步原則**
- 資料庫才是真相：事件只通知「有新版本」，頁面再去拿快照。
- 串流文字有序號，缺號時不拼接，改成重新同步。
- 斷線重連後一律重新取快照。

**上游限制**
- 列在上方表格，範例都已經自行處理。
