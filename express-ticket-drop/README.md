# Ticket drop with a waiting room (Express)

500 seats, 3,000 buyers in three seconds. This example shows what happens to
a plain checkout under that rush, and the same rush behind a
[Hibira](https://hibira.io) virtual waiting room.

| | Seats sold | Oversold | Failed checkouts |
|---|---|---|---|
| `npm run before`, no waiting room | 875 | 375 | 2,125 |
| `npm start`, with the waiting room | 500 | 0 | 0 |

(One run on a laptop; your numbers will differ a little.)

- `before.js`: the shop as most of us first write it. The checkout reads the
  seats left, then writes, in two queries, so thousands of buyers read
  "seats left" before anyone writes. The rest wait for a database
  connection until they time out. `lib/db.js` stands in for the database:
  10 connections, 25 ms a query, 1.5 s acquire timeout.
- `server.js`: the same shop with `expressWaitingRoom` from
  [@hibira-io/waiting-room](https://github.com/hibira-io/waiting-room) in
  front of `/drop` and `/api/buy`. Visitors without a pass go to Hibira's
  hosted waiting page, take a number, watch their place live and come back
  with a signed pass. The checkout takes a seat in one step, sells once per
  queue number, and closes the room when the last seat goes, so the people
  still in line see "sold out" right away.
- `scripts/create-room.js`: creates the room (1,200 visitors a minute).
- `scripts/flood.js`: the load test. Each buyer does what a browser does:
  open `/drop`, follow the redirect to the waiting room, take a number, ask
  for a pass until it's their turn, then check out.
- `public/monitor.html`: seats sold, seats left, failed checkouts and the
  waiting room's line, live.

## Run it

1. Create an app on [hibira.io](https://hibira.io/portal) and copy its ID,
   key and secret into `.env` (see `.env.example`).
2. `npm install`
3. Before: `node --env-file=.env before.js`, open
   http://localhost:3000/monitor, then `node --env-file=.env scripts/flood.js`
   in another terminal.
4. After: `node --env-file=.env scripts/create-room.js`, then
   `node --env-file=.env server.js` and the same flood.

The hosted waiting page limits how often one IP address may join, so a
flood of 3,000 buyers from one machine works against a Hibira server you run
yourself (set `HIBIRA_HOST`, `HIBIRA_PORT`, `HIBIRA_TLS=false`,
`HIBIRA_WAIT_HOST` and `LOCAL_IPS=1`, which sends each buyer from its own
127.x.y.z address). Against ws.hibira.io, open `/drop` in a few browsers
instead, or lower `ADMIT_PER_MINUTE` to watch the line move.

In production, put the pass check at the edge (Cloudflare Workers, Next.js
middleware, Netlify, CloudFront); see the
[package README](https://github.com/hibira-io/waiting-room#2-protect-the-page-at-the-edge).

## 中文摘要

搶票情境的範例：500 個座位、3,000 個買家在 3 秒內湧入。`before.js` 沒有排隊室，
結帳先讀再寫，結果超賣 375 個座位、2,125 筆結帳逾時。`server.js` 在前面放了
Hibira 排隊室（`expressWaitingRoom`），買家拿號碼、即時看順位、分批帶著簽章通行證進場；
結帳一步完成扣座位、每個號碼只買一次，賣完就關閉排隊室。結果剛好賣出 500 個、0 失敗。
`scripts/flood.js` 是壓力測試腳本。
