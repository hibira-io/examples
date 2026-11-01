# 部署

這個範例可以部署成一個**有登入保護**的示範環境。本文件只說明怎麼部署；
本次交付沒有實際對外部署，也**沒有提供公開試玩模式**（見最後一節）。

## 元件

| 元件 | 指令 | 說明 |
|---|---|---|
| Web | `frankenphp php-server --root public/`（Docker）或任何 PHP-FPM + Nginx | 頁面、JSON、`/broadcasting/auth` |
| Queue worker | `php artisan queue:work --tries=1` | agent 的每一輪與審批後的接續；**必須常駐** |
| PostgreSQL 16+ | | 業務資料、審批、agent 對話、session、cache、queue |
| Hibira app | | WebSocket（Pusher 協定），由 hibira.io 託管 |

`compose.yaml` 把前三者包在一起：

```sh
cp .env.example .env    # 填入下表的值
docker compose up -d --build
docker compose ps       # postgres、app、worker 都應該是 healthy
```

## 環境變數

| 變數 | 必填 | 說明 |
|---|---|---|
| `APP_KEY` | ✔ | `php artisan key:generate --show` 產生 |
| `APP_ENV` | ✔ | 正式環境用 `production`：會關閉 DEMO_MODE、拒絕 `demo:reset`、`demo:smoke` 與 DemoSeeder |
| `APP_DEBUG` | ✔ | 正式環境 `false` |
| `APP_URL` | ✔ | 對外網址，例如 `https://approvals-demo.example.com` |
| `DB_HOST` `DB_PORT` `DB_DATABASE` `DB_USERNAME` `DB_PASSWORD` | ✔ | PostgreSQL |
| `QUEUE_CONNECTION` | ✔ | `database`（預設） |
| `HIBIRA_APP_ID` `HIBIRA_APP_KEY` `HIBIRA_APP_SECRET` | ✔ | Hibira app。Secret 只在伺服器，不進前端、不進 git、不寫進日誌 |
| `HIBIRA_HOST` `HIBIRA_PORT` `HIBIRA_SCHEME` | | 預設 `ws.hibira.io`、443、https（TLS） |
| `HIBIRA_PUSH_INSTANCE_ID` `HIBIRA_PUSH_SECRET_KEY` | | 選用：推播給沒開收件匣的主管 |
| `AI_PROVIDER` | | `demo-mock`（預設）或 config/ai.php 的 provider 名稱 |
| `AI_MODEL` | | Live 模式選用；留空用 SDK 預設模型 |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / … | Live 模式 | 只在伺服器端使用 |
| `DEMO_MODE` | | 一鍵登入示範帳號。**共用或公開的部署一律 `false`** |
| `TRUSTED_PROXIES` | | 在負載平衡器／反向代理後面時，填代理的 IP 或 `*`，讓 Laravel 認得 HTTPS |
| `HIBIRA_APPROVALS_QUEUE` | | 選用：審批接續用的獨立 queue 名稱 |

`.env`、API key、Hibira secret 都不要提交；`.gitignore` 與 `.dockerignore` 已排除 `.env`。

## 建置與上線步驟

```sh
composer install --no-dev --optimize-autoloader   # 也會發布 Filament 的前端資產（filament:upgrade）
npm ci && npm run build                           # Vite → public/build
php artisan migrate --force                       # Docker：RUN_MIGRATIONS=true 時 app 啟動會做
php artisan optimize                              # 快取 config、routes、views
```

部署新版本時，先跑 migration，再重新啟動 worker（`php artisan queue:restart`），讓它載入新程式碼。

## 持久資料

全部在 PostgreSQL：訂單、案件、訊息、`refund_operations`、`refunds`、`hibira_approval_*`、
`agent_conversation*`、`jobs`／`failed_jobs`、session。請替資料庫設定備份。
`storage/logs` 的 `laravel.log` 與 `diagnostics.log` 可以丟棄；Docker 版用 volume `storage` 保存。

## HTTPS 與 Allowed origins

- 正式環境一律走 HTTPS（反向代理或平台負責 TLS），並設定 `TRUSTED_PROXIES`。
- Hibira 連線預設是 `wss://ws.hibira.io:443`。
- 在 Hibira app 的 **Allowed origins** 加上 `APP_URL` 的 origin（例如 `https://approvals-demo.example.com`）。
  不要用 `*`，也不要為了測試關閉來源檢查。
- private／presence 頻道都經過 `/broadcasting/auth` 授權：客戶只能訂閱自己的案件，收件匣頻道只有主管。

## 健康檢查

| 檢查 | 怎麼做 |
|---|---|
| Web | `GET /up` 回 200（compose 的 app healthcheck） |
| Worker | `php artisan queue:health --max-wait=120`：有工作等超過 120 秒沒人處理就失敗（compose 的 worker healthcheck） |
| 資料庫 | `pg_isready`（compose 的 postgres healthcheck） |
| Hibira | `php artisan hibira:check` |

Worker 停掉時：客戶的訊息與主管的決定都已保存，worker 恢復後會繼續處理。
如果 worker 在處理審批接續時被殺掉，那筆請求會在收件匣顯示「失敗」，主管按「重試」即可，同一個退款操作不會重複執行。

## 示範模式的邊界

- `DEMO_MODE=true` 只適合本機或私人的示範環境：登入頁出現四個示範帳號的一鍵登入。`APP_ENV=production` 時強制關閉。
- 示範帳號只能用 `php artisan demo:reset` 在非 production 環境建立；`DatabaseSeeder` 不建立任何帳號，
  所以部署不會自動出現共用的管理員帳號。
- `demo:reset` 只清除示範訂單 DEMO-1042 的案件、審批、退款與對話，不是 `migrate:fresh`；
  被清除的案件留在 queue 裡的工作會找不到案件而直接結束。
- **公開試玩模式：本次沒有提供。** 公開試玩需要每位訪客各自隔離的示範情境、有期限的情境存取憑證、
  受控的角色切換、用量限制，以及只清除自己情境的 reset。這些沒有在本版實作，
  所以請不要把 `DEMO_MODE=true` 的部署公開給不特定的訪客，也不要用共用帳號代替。
