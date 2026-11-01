# 在你的 Laravel 專案接入 AI 審批

這份說明把範例拆成兩部分：**必需的整合程式**（任何用 Laravel AI SDK 做 agent、想讓人審批工具呼叫的專案都需要），
以及**這個範例的業務**（訂單、退款、客服頁），後者只是示範，換成你自己的就好。

需求：PHP 8.3+、Laravel 12 或 13、Filament 3.3 / 4 / 5、一個 Hibira app（[hibira.io/portal](https://hibira.io/portal)）。

## A. 必需的整合程式

### 1. 安裝套件

```sh
composer require hibira-io/filament-approvals laravel/ai
php artisan vendor:publish --provider="Laravel\Ai\AiServiceProvider"   # config/ai.php 與對話資料表
php artisan migrate                                                    # 也會建立 hibira_approval_* 資料表
```

`.env` 加上 Hibira 設定（`php artisan hibira:install` 也會幫你加），然後 `php artisan hibira:check`：

```dotenv
BROADCAST_CONNECTION=hibira
HIBIRA_APP_ID=
HIBIRA_APP_KEY=
HIBIRA_APP_SECRET=
```

### 2. 讓工具先問人：`Approvable`

這是 Laravel AI SDK 自己的功能。範例：[app/Ai/Tools/IssueRefund.php](../app/Ai/Tools/IssueRefund.php)。

```php
class IssueRefund implements Approvable, Tool
{
    use InteractsWithApprovals;

    protected function needsApproval(Request $request): Approval|bool
    {
        return Approval::required('所有退款都需要主管審批。');
    }
    // description()、schema()、handle()
}
```

`handle()` 在**審批之後**、在 queue worker 上執行，拿到的是主管核准（或修改後）的參數。
在這裡用後端資料重新驗證一次，不要相信參數本身。

### 3. Agent 要記得對話：`RemembersConversations`

暫停的那一輪要能接續，agent 必須用 SDK 的對話記憶。範例：[app/Ai/Agents/SupportAgent.php](../app/Ai/Agents/SupportAgent.php)。

```php
class SupportAgent implements Agent, Conversational, HasTools
{
    use Promptable, RemembersConversations;
}

// 每一輪都接續同一個對話，並帶上使用者
(new SupportAgent)->continue($conversationId, as: $user)->stream($text);
```

### 4. Filament 面板加上收件匣

範例：[app/Providers/Filament/AdminPanelProvider.php](../app/Providers/Filament/AdminPanelProvider.php)。

```php
->plugins([
    HibiraPlugin::make()->connectionStatus(),
    HibiraApprovalsPlugin::make()
        ->authorize(fn (User $user) => $user->isApprover())   // 誰能看、能決定；也用在 Hibira 頻道授權
        ->approvers(fn () => User::where('role', 'approver')->get()),  // 誰收推播
])
```

`authorize()` 同時保護頁面、每一個決定與 Hibira 的 private／presence 頻道，不是只隱藏按鈕。

### 5. 跑 queue worker

```sh
php artisan queue:work
```

主管送出決定後，套件的 `ResumeAgent` job 在 queue 上接續 agent。agent 能長時間執行靠的是 worker，
不是 WebSocket；serverless 環境的執行時間限制不會因為改用 Hibira 而消失。

到這裡就是完整的人工審批：agent 暫停 → 收件匣即時出現 → 主管決定 → queue 接續。

## B. 視需要加上的整合點

這些是範例用到的套件擴充點，都不需要修改 `vendor/`。

| 需求 | 做法 | 範例位置 |
|---|---|---|
| 接續時更新你自己的業務狀態、用自己的頻道串流 | `HibiraApprovals::resumeUsing(fn ($request, $decisions, $user) => ...)` | `AppServiceProvider` → `SupportTurns::resume()` |
| 主管決定時就用後端資料驗證參數、不讓第二位主管覆寫已做的決定 | 在 container 綁定 `ApprovalDesk` 的子類別 | [app/Support/RefundApprovalDesk.php](../app/Support/RefundApprovalDesk.php) |
| worker 中途死掉時，請求不要永遠卡在「繼續中」 | 監聽 `JobFailed`，把 `ResumeAgent` 的請求標成失敗，讓主管重試 | `AppServiceProvider::boot()` |
| 收件匣旁顯示業務資訊 | Filament render hook，範圍限定在 `Approvals` 頁 | [app/Livewire/RefundContext.php](../app/Livewire/RefundContext.php) |
| 測試時不連模型 | 自訂 provider driver（`Ai::extend()`），只替換模型輸出 | [app/Ai/Mock/MockSupportGateway.php](../app/Ai/Mock/MockSupportGateway.php) |

## C. 這個範例的業務（換成你自己的）

- `orders`、`support_cases`、`support_messages`、`refund_operations`、`refunds` 資料表與對應 model。
- [app/Support/RefundService.php](../app/Support/RefundService.php)：模擬退款。金額一律是整數最小單位（4900 = USD 49.00）。
  冪等的做法：
  - 每個退款工具呼叫，在暫停審批時就建立一筆 `refund_operations`，它的 UUID 就是**邏輯操作 ID**；
    `approval_tool_call_id` 唯一，所以重試永遠找到同一筆。
  - 執行時在交易裡 `SELECT … FOR UPDATE` 鎖住操作與訂單，`refunds.operation_id` 唯一，訂單有 CHECK 約束不能退超過已付金額。
  - 已完成的操作再執行一次，回傳保存的結果，不會再退一次。
  - **接真實金流時**：把操作 ID 當成金流供應者的 idempotency key 傳過去，並核對供應者回報的結果。
    本機資料庫交易沒辦法讓第三方 API 呼叫變成 exactly-once。
- [app/Support/SupportTurns.php](../app/Support/SupportTurns.php)：客服案件的狀態機與 agent 每一輪的執行。
- [resources/js/support.js](../resources/js/support.js)：客戶頁。
- `routes/channels.php`：`private-support.case.{id}` 只授權給案件的客戶。

## 客戶畫面的即時與恢復

範例的做法，也是我們建議的模式：

1. **資料庫是真相**。每次狀態改變先寫資料庫，`version` 加一，提交之後才送 Hibira 事件。
2. **事件只說「有新版本」**：`case.updated {v, status}`。瀏覽器看到比自己新的版本，就呼叫 `GET /cases/{id}` 取快照。
   舊的、重複的事件自然被忽略；事件送失敗也不會遺失任何決定。
3. **串流文字有編號**：`agent.delta {run, seq, text}`。順序正確就接上；缺號就標成「內容不完整，正在重新同步」，
   不把缺口後的文字接上去，等這一輪結束後從快照拿保存的完整回答。
4. **重新連線一定重拿快照**，不依賴「曾經收到過的事件」。

Hibira 的 Channel History（rewind）是付費方案的選用功能：每個頻道最多保留最近 100 個事件，有時間與容量上限，
client events 不保存，回放可能回傳 `complete: false`。這個範例不依賴它；如果你開啟它來補短暫斷線，
`complete: false` 時一樣要回後端重拿狀態。

## 上游套件的已知限制

接入時我們發現下列可以在套件裡改善的地方，範例都已經用上面的擴充點處理，不需要等套件更新：

| 套件 | 現況 | 建議的最小修正 | 驗證方式 |
|---|---|---|---|
| hibira-io/filament-approvals 0.1.1 | `ApprovalDesk::decide()` 會覆寫另一位審查者剛做的決定；收件匣「全部核准／拒絕」是先 decide 再 send 兩步，兩位主管同時按時，送出的可能是另一人的決定 | `decide()` 只更新尚未決定或自己決定的呼叫，其餘回傳衝突；`decideAll` 在同一個鎖定交易裡決定並送出 | 兩個 process 同時 decideAll（範例的 `tests/Concurrency/ConcurrentDecisionsTest.php`） |
| hibira-io/filament-approvals 0.1.1 | 沒有「驗證修改後參數」的掛勾，非法參數要等工具執行時才被擋 | `HibiraApprovals::validateUsing(fn (ToolCall $call, array $arguments): ?string)`，在 decide 時回傳錯誤字串 | 範例的 `RefundValidationTest` |
| hibira-io/filament-approvals 0.1.1 | `ResumeAgent` 沒有 `failed()`：worker 被殺掉時請求停在 resuming | 加上 `failed()`，把仍在 resuming 的請求標成 failed | 範例的 `WorkerCrashTest` |
| hibira-io/laravel | AI bridge（`AgentChannel`）在 0.2，但 hibira-io/filament 0.2 仍要求 hibira-io/laravel ^0.1，所以和 filament-approvals 一起安裝時只會裝到 0.1.2 | hibira-io/filament 放寬為 `^0.1\|^0.2` | `composer require hibira-io/filament-approvals hibira-io/laravel:^0.2` 能解析 |
