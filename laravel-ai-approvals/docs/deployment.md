# Deployment

This example can be deployed as a demo environment behind a login. This document only explains how. No deployment was made for this release, and **no public trial mode is provided** (see the last section).

> 中文摘要在最後：[中文摘要](#中文摘要)。

## Components

| Component | Command | Notes |
|---|---|---|
| Web | `frankenphp php-server --root public/` ([FrankenPHP](https://frankenphp.dev), in Docker) or any PHP-FPM + Nginx | Pages, JSON, `/broadcasting/auth` |
| Queue worker | `php artisan queue:work --tries=1` | Every agent turn and every resume after a decision. **Must always be running** |
| PostgreSQL 16+ | | Business data, approvals, agent conversations, sessions, cache, queue |
| Hibira app | | WebSocket (Pusher protocol), hosted by hibira.io |

`compose.yaml` bundles the first three:

```sh
cp .env.example .env    # fill in the values below
docker compose up -d --build
docker compose ps       # postgres, app and worker should all be healthy
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `APP_KEY` | ✔ | Generate with `php artisan key:generate --show` |
| `APP_ENV` | ✔ | `production` turns off DEMO_MODE and refuses `demo:reset`, `demo:smoke` and DemoSeeder |
| `APP_DEBUG` | ✔ | `false` in production |
| `APP_URL` | ✔ | Public address, e.g. `https://approvals-demo.example.com` |
| `DB_HOST` `DB_PORT` `DB_DATABASE` `DB_USERNAME` `DB_PASSWORD` | ✔ | PostgreSQL |
| `QUEUE_CONNECTION` | ✔ | `database` (default) |
| `HIBIRA_APP_ID` `HIBIRA_APP_KEY` `HIBIRA_APP_SECRET` | ✔ | The Hibira app. The secret stays on the server: never in the frontend, git or logs |
| `HIBIRA_HOST` `HIBIRA_PORT` `HIBIRA_SCHEME` | | Default `ws.hibira.io`, 443, https (TLS) |
| `HIBIRA_PUSH_INSTANCE_ID` `HIBIRA_PUSH_SECRET_KEY` | | Optional: push notifications to managers without the inbox open |
| `AI_PROVIDER` | | `demo-mock` (default) or a provider name from `config/ai.php` |
| `AI_MODEL` | | Optional in Live mode; empty uses the SDK default |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` / … | Live mode | Used only on the server |
| `DEMO_MODE` | | One-click login for the demo accounts. **Always `false` on shared or public deployments** |
| `TRUSTED_PROXIES` | | Behind a load balancer or reverse proxy, the proxy IPs or `*`, so Laravel recognizes HTTPS |
| `HIBIRA_APPROVALS_QUEUE` | | Optional: a separate queue name for approval resumes |

Don't commit `.env`, API keys or the Hibira secret. `.gitignore` and `.dockerignore` already exclude `.env`.

## Build and release

```sh
composer install --no-dev --optimize-autoloader   # also publishes Filament's frontend assets (filament:upgrade)
npm ci && npm run build                           # Vite → public/build
php artisan migrate --force                       # in Docker, the app does this on start when RUN_MIGRATIONS=true
php artisan optimize                              # cache config, routes and views
```

For a new version, run the migrations first. Then restart the worker with `php artisan queue:restart` so it loads the new code.

## Persistent data

Everything lives in PostgreSQL:

- orders, cases, messages
- `refund_operations`, `refunds`
- `hibira_approval_*`
- `agent_conversation*`
- `jobs` / `failed_jobs`
- sessions

Back up the database. `laravel.log` and `diagnostics.log` in `storage/logs` can be thrown away; the Docker setup keeps them on the `storage` volume.

## HTTPS and Allowed origins

- Always use HTTPS in production. A reverse proxy or the platform terminates TLS; set `TRUSTED_PROXIES`.
- The Hibira connection defaults to `wss://ws.hibira.io:443`.
- Add the origin of `APP_URL` (e.g. `https://approvals-demo.example.com`) to the Hibira app's **Allowed origins**. Don't use `*`, and don't turn the origin check off for testing.
- Private and presence channels are authorized through `/broadcasting/auth`. Customers can subscribe only to their own case, and only managers can subscribe to the inbox channels.

## Healthchecks

| Check | How |
|---|---|
| Web | `GET /up` returns 200 (the compose app healthcheck) |
| Worker | `php artisan queue:health --max-wait=120` fails when a job has waited more than 120 s (the compose worker healthcheck) |
| Database | `pg_isready` (the compose postgres healthcheck) |
| Hibira | `php artisan hibira:check` |

When the worker stops, customer messages and manager decisions are already saved, and the worker picks them up when it comes back. If the worker is killed while resuming an approval, the request shows as failed in the inbox. A manager clicks Retry, and the same refund operation doesn't run twice.

## Demo-mode limits

- `DEMO_MODE=true` is only for local or private demos: the login page shows one-click login for the four demo accounts. It is forced off with `APP_ENV=production`.
- Demo accounts can only be created with `php artisan demo:reset` outside production. `DatabaseSeeder` creates no accounts, so a deployment never comes with a shared admin account.
- `demo:reset` clears only the cases, approvals, refunds and conversations of demo order DEMO-1042; it is not `migrate:fresh`. Jobs still in the queue for a cleared case find no case and exit.
- **Public trial mode: not provided in this release.** A public trial would need all of the following:
  - an isolated scenario for each visitor
  - time-limited access tokens for each scenario
  - controlled role switching
  - usage limits
  - a reset that clears only the visitor's own scenario

  None of these is built. Don't open a `DEMO_MODE=true` deployment to anonymous visitors, and don't use shared accounts instead.

## 中文摘要

**元件**
- 部署需要四個元件：Web（Docker 版用 FrankenPHP）、常駐的 queue worker、PostgreSQL，以及一個 Hibira app。
- `docker compose up -d --build` 會一次啟動前三個，每個都有 healthcheck。

**環境變數與密鑰**
- 環境變數的名稱與用途見上方表格。
- App secret、模型 API Key 與 Push secret 只放在伺服器端，不會進到前端、git 或日誌。

**上線**
- 正式環境一律使用 HTTPS。
- 在 Hibira app 的 Allowed origins 填入 `APP_URL`，不要用 `*`。
- 發布新版本時先跑 migration，再執行 `queue:restart`。

**示範模式**
- `DEMO_MODE` 只適合本機或私人的示範環境，在 production 會被強制關閉。
- `demo:reset` 只清除示範訂單 DEMO-1042 相關的資料，不是 `migrate:fresh`。
- 這一版沒有提供公開試玩模式。
