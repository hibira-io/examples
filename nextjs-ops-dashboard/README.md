# Ops dashboard: polling vs push (Next.js + Postgres)

The same API health dashboard built two ways, with a load script so you can
see the difference on your own database.

- **Polling** (`/?mode=poll`): every open dashboard calls `/api/stats` once
  a second, and every call runs the full query. 200 viewers means 200 copies
  of the same query every second.
- **Push** (`/?mode=push`): one worker runs the query once a second and
  publishes the result to a Hibira channel. Every open dashboard gets it over
  WebSocket, and a large presence channel shows how many people are watching.

On a 2 vCPU Postgres with 200 dashboards open, polling kept Postgres at
100% CPU and the numbers on screen fell more than 10 seconds behind. Push
kept Postgres at about 1% CPU, with fresh numbers every second on every
screen.

## What it shows

- **Publishing from a worker.** `scripts/publisher.ts` calls `readStats()`
  once a second and `trigger()` from the
  [`pusher`](https://www.npmjs.com/package/pusher) Node SDK, pointed at
  Hibira with `host`. The secret never reaches the browser.
- **Polling vs subscribing.** `components/useStats.ts` has both hooks:
  `usePolling()` with `setInterval` + `fetch`, and `usePush()` with
  [`pusher-js`](https://www.npmjs.com/package/pusher-js) bound to the
  `stats` event of `private-ops-stats`.
- **A large presence channel.** "Watching now" comes from
  `presence-large-ops-viewers` through
  [`@hibira-io/large-presence`](https://github.com/hibira-io/large-presence-js),
  which keeps an exact count from five viewers to 100,000.
- **Channel authorization.** `app/api/hibira/auth/route.ts` signs both
  channels. A real dashboard checks its own session there.

## Run it

1. Create a free app on [hibira.io](https://hibira.io/portal) (no card) and
   add `http://localhost:3000` to its allowed origins.
2. Create a database and load two hours of made-up traffic:

   ```sh
   createdb ops
   psql ops -f scripts/seed.sql
   ```

3. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and the
   app ID, key and secret.
4. Start it:

   ```sh
   npm install
   npm run build && npm start   # the dashboard on http://localhost:3000
   npm run traffic              # keeps inserting requests, so numbers move
   npm run publisher            # only needed for push mode
   ```

5. Open <http://localhost:3000/?mode=poll>, then add viewers:

   ```sh
   npm run viewers -- poll 200 8   # 200 polling dashboards, ramped over 8 s
   ```

   Watch the "Updated … ago" badge and your database's CPU. Stop it, open
   <http://localhost:3000/?mode=push> and run the same test with `push`.

Add `&lang=zh-TW` or `&lang=ja` to the URL for Traditional Chinese or
Japanese.

## 中文摘要

同一個 API 健康面板的兩種做法：輪詢模式下每個開著的面板每秒查一次 Postgres；
推送模式下只由 `scripts/publisher.ts` 每秒查一次，再透過 Hibira 頻道送給所有面板，
並用大型 presence 頻道顯示觀看人數。`npm run viewers -- poll 200 8` 可以模擬 200 個面板，
自己比較資料庫負載與資料延遲。
