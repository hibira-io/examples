# Hibira Agent Approvals Demo（AI 客服退款審批）

A Laravel 13 + Filament 5 example: a support agent built on the
[Laravel AI SDK](https://laravel.com/docs/ai-sdk) asks to refund an order,
two managers see the request live in a Filament inbox
([hibira-io/filament-approvals](https://github.com/hibira-io/filament-approvals)),
one of them approves a lower amount, the agent carries on from the queue and
the customer's chat updates over [Hibira](https://hibira.io). Runs without a
model API key (Mock mode). The UI is in Traditional Chinese.

這個範例用一個完整的業務流程，展示 Hibira 怎麼串起：

- AI agent 的工具呼叫與**人工審批**（Laravel AI SDK 原生的 tool approval）。
- 多位主管的**即時收件匣**、誰在線上、誰正在看同一筆請求，以及決策同步。
- 決定之後由 **queue** 接續 agent，執行**冪等的模擬退款**。
- 客戶畫面的**即時回覆**，以及重新整理、斷線後從後端**恢復業務狀態**。

Hibira 只負責即時傳遞；訂單、審批決策、退款紀錄與 agent 的對話都保存在這個應用自己的 PostgreSQL。

| 畫面 | |
|---|---|
| 客戶：訂單摘要、退款紀錄、與客服 AI 對話 | `/support` |
| 主管：AI 審批收件匣（filament-approvals） | `/admin/ai-approvals` |
| 主管：退款操作、訂單（唯讀） | `/admin/refund-operations`、`/admin/orders` |

## 最短啟動路徑

需要：一個 Hibira app（[hibira.io/portal](https://hibira.io/portal) 建立，免費方案即可、不需信用卡）。

### 用 Docker（不需要本機 PHP）

```sh
cp .env.example .env
# 編輯 .env：填入 HIBIRA_APP_ID、HIBIRA_APP_KEY、HIBIRA_APP_SECRET
docker compose run --rm --no-deps app php artisan key:generate --show
# 把印出的 base64:... 貼到 .env 的 APP_KEY=
docker compose up -d --build
docker compose exec app php artisan demo:reset
```

打開 <http://localhost:8000>。`compose.yaml` 會啟動 app、queue worker、PostgreSQL 17（含健康檢查與資料 volume）。

### 用本機 PHP 8.3+、Node 22、PostgreSQL

```sh
composer install
cp .env.example .env && php artisan key:generate
# 編輯 .env：DB_*（PostgreSQL）與 HIBIRA_APP_ID / HIBIRA_APP_KEY / HIBIRA_APP_SECRET
php artisan migrate
php artisan demo:reset
npm ci && npm run build

php artisan serve          # 終端機 1
php artisan queue:work     # 終端機 2：agent 的每一輪與審批後的接續都在這裡跑
```

### Hibira 測試 app 設定

1. 在 portal 建立 app，從 app 頁複製 **App ID、Key、Secret** 到 `.env`。
   Secret 只放在伺服器端，瀏覽器只會拿到 key 與 host。
2. 在 app 的 **Allowed origins** 加上你開啟範例的網址，例如 `http://localhost:8000`。
   不要為了測試關掉來源檢查。
3. `php artisan hibira:check` 檢查設定與連線。
4. （選用）Hibira Push：填 `HIBIRA_PUSH_INSTANCE_ID`、`HIBIRA_PUSH_SECRET_KEY`，
   沒開收件匣的主管會收到推播。沒有 Push 憑證時主流程照常運作。

## 登入角色

`php artisan demo:reset` 建立四個示範帳號（密碼都是 `DEMO_PASSWORD`，預設 `demo-password`）與一筆訂單
**DEMO-1042**（已付款 USD 49.00，已退款 0）。

| 帳號 | 角色 | 可以做什麼 |
|---|---|---|
| `customer@demo.test` | 客戶 | 看自己的訂單、提出退款、看客服回覆 |
| `manager.a@demo.test` | 主管 A | Filament 審批收件匣：批准、修改金額、拒絕 |
| `manager.b@demo.test` | 主管 B | 同上，用來示範兩位主管同步 |
| `outsider@demo.test` | 無權限 | 什麼都不能看，用來測授權 |

`DEMO_MODE=true` 時登入頁會出現一鍵登入按鈕（只列這四個帳號）。`APP_ENV=production` 時一律關閉，
`DatabaseSeeder` 也不會建立任何帳號：示範帳號只能用 `demo:reset` 在非 production 環境建立。

## 操作步驟

1. 一個瀏覽器以**客戶**登入，打開 `/support`。另外兩個瀏覽器（或無痕視窗）以**主管 A**、**主管 B** 登入，進到「AI 審批」。
   兩位主管會看到「另有 1 位審查者在線上」。
2. 客戶輸入「我想退掉這筆訂單」。客服 AI 查詢訂單，提出 USD 49.00 的退款並說明要等主管審批；輸入框鎖住。
3. 兩位主管的收件匣同時出現這筆請求，上方顯示訂單已付、已退、可退金額。兩人都打開它時，會看到「正在一起審查」。
4. 主管可以：**核准**原金額；**修改**，把 `"amount": 4900` 改成 `2900` 後「用這些參數執行」；或**拒絕**並寫理由。
5. 決定送出後，queue worker 接續 agent：核准就寫入退款紀錄，拒絕就不退款，agent 把結果告訴客戶。
6. 客戶畫面即時更新為「已完成」或「已拒絕」，訂單的已退金額同步改變。重新整理後一切都還在。

90 秒的展示腳本見 [docs/demo-script.md](docs/demo-script.md)。

## Mock 與 Live 模式

| | Mock（預設） | Live（選用） |
|---|---|---|
| 設定 | `AI_PROVIDER=demo-mock` | `AI_PROVIDER=gemini` + `GEMINI_API_KEY`，或 `openai` + `OPENAI_API_KEY`，或 config/ai.php 裡任一 Laravel AI SDK provider |
| 模型 | `App\Ai\Mock\MockSupportGateway` 依對話內容產生固定的工具呼叫與回覆 | 真實模型；`AI_MODEL` 可指定，留空用 SDK 的預設模型 |
| 其他一切 | 相同：SDK 的工具驗證、審批暫停、對話保存、接續、queue、Hibira | 相同 |

Mock 模式**只替換模型的輸出**：它是一個 `StepTextGateway`，註冊成 `demo-mock` provider（`AppServiceProvider`）。
工具、審批、資料庫、queue 與 Hibira 通訊都是真的，所以不需要 API key 也能完整重現流程。
無論哪個模式，模型都只能呼叫模擬退款工具，模型金鑰只在伺服器端使用。

```sh
php artisan demo:reset && php artisan demo:smoke            # 不開瀏覽器跑一次完整流程（Mock）
php artisan demo:reset && AI_PROVIDER=gemini php artisan demo:smoke   # 用真實模型檢查 Live 模式
```

失敗路徑也能示範：`DEMO_MOCK_AI_FAILURE=true`（模型呼叫失敗）、`DEMO_MOCK_AI_FAILURE_AFTER_REFUND=true`
（退款已提交、agent 回覆前失敗，主管在收件匣按「重試」，不會重複退款）。

## 測試

```sh
npm test                                   # 前端狀態：亂序、重複、缺漏事件、重新連線
php artisan test --testsuite=Feature       # 流程、金額驗證、授權、重試與恢復（PostgreSQL）
php artisan test --testsuite=Concurrency   # 多個 PHP process 同時決策／退款；queue:work 在交易前後被 kill
BASE_URL=http://127.0.0.1:8000 node tests/e2e/approval-flow.mjs   # 三個瀏覽器 context 的 E2E（見下）
```

- Feature 與 Concurrency 測試用 PostgreSQL（`phpunit.xml`：資料庫 `demo_test`，帳密 `demo`/`demo`，可用 `DB_*` 環境變數覆寫）。
  Feature 測試用 `tests/Support/FakeHibira.php` 記錄送往 Hibira 的事件，不連線。
- Concurrency 測試啟動多個獨立的 PHP process，各自連 PostgreSQL，在同一時間點出手；worker 測試用 `DEMO_CRASH_AT`
  讓真的 `queue:work` 在退款交易提交前或後 `SIGKILL` 自己（只在 `APP_ENV=testing` 有效）。
- E2E 需要執行中的 app、queue worker、`DEMO_MODE=true`、`php artisan demo:reset`，以及真的 WebSocket 伺服器
  （Hibira 測試 app，Allowed origins 要包含 `BASE_URL`）。它驗證三個瀏覽器的即時同步，並確認更新是從 WebSocket 收到的，
  不是輪詢。CI 在有 `HIBIRA_E2E_*` secrets 時才跑這一段。

## 排錯

| 現象 | 檢查 |
|---|---|
| 客戶頁右上角一直「連線中」或「無法連上即時服務」 | `HIBIRA_APP_KEY`、`HIBIRA_HOST`；app 的 Allowed origins 是否包含目前網址；`php artisan hibira:check` |
| 收件匣收不到新請求、`/broadcasting/auth` 403 | 是否用主管帳號登入；`HIBIRA_APP_SECRET` 是否正確 |
| 客戶送出後一直「客服 AI 正在處理」 | `php artisan queue:work` 有沒有在跑；`php artisan queue:health` |
| 主管決定後一直「繼續中」 | 同上；worker 中斷時請求會變成「失敗」，在收件匣按「重試」 |
| Live 模式回覆「暫時無法回覆」 | `storage/logs/laravel.log` 的 provider 錯誤（例如 401 是 API key 無效） |
| 想從頭再來 | `php artisan demo:reset`（只清示範訂單的資料，不是 `migrate:fresh`） |

診斷事件（`approval_requested`、`approval_decided`、`agent_resumed`、`refund_completed`、`refund_replayed`、`flow_failed`）
以 JSON 一行一筆寫在 `storage/logs/diagnostics.log`，只有事件名稱、關聯 ID、狀態與時間，不含對話、工具參數或任何金鑰。

## 文件

- [docs/integration.md](docs/integration.md)：在你自己的 Laravel 專案接入審批套件；哪些是必需的整合，哪些只是這個範例的業務。
- [docs/deployment.md](docs/deployment.md)：環境變數、資產建置、migration、worker、HTTPS、Allowed origins、健康檢查、示範模式邊界。
- [docs/demo-script.md](docs/demo-script.md)：90 秒展示腳本。
- [docs/pilot-checklist.md](docs/pilot-checklist.md)：第一批試用者的接入清單、訪談問題與指標定義。

## 版本

PHP 8.3+（Docker 與 CI 用 8.4）、Laravel 13.39、Filament 5.11、Livewire 4.4、laravel/ai 1.3、
hibira-io/filament-approvals 0.1.1、hibira-io/filament 0.2.3、hibira-io/laravel 0.1.2、PostgreSQL 17.6、
laravel-echo 2 + pusher-js 8。鎖定檔：`composer.lock`、`package-lock.json`。

## License

MIT
