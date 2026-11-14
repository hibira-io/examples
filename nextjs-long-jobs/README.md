# Long jobs, streamed (Next.js)

A report that takes 20 seconds to build. The old way, one request that
waits for the whole job, leaves the user looking at a spinner and dies when
the host's time limit comes first. The new way answers in milliseconds,
keeps the job running after the response, and sends each line to a Hibira
channel as it is written, so every open tab and phone shows the same
progress live.

## What it shows

- **The problem.** `/blocking` calls `app/api/report/blocking/route.ts`,
  which builds the whole report before it answers. With
  `maxDuration = 10`, a serverless host stops it with a 504 before the
  job is done.
- **Answer now, keep working.** `app/api/report/route.ts` returns `202`
  with the job's id and runs the job in `after()` from `next/server`.
- **Stream the output.** `streamToChannel()` from
  [`@hibira-io/react/server`](https://github.com/hibira-io/react) batches
  the job's text into numbered events on `private-reports`, under the 4 KB
  Free plan limit. It also takes an LLM SDK stream or a `ReadableStream`
  as it is.
- **Show it in every tab.** `components/Report.tsx` follows the channel
  with `useChannel()` and `useStream()` and renders the text as it grows.
- **Private channel.** `app/api/hibira/auth/route.ts` signs subscriptions.
  A real app checks its own session there.
- `lib/report.ts` stands in for your slow job. Swap in your own.

## Run it

1. Create a free app on [hibira.io](https://hibira.io/portal) (no card),
   and add `http://localhost:3000` to its **Allowed origins**.
2. Copy `.env.example` to `.env.local` and fill in the app ID, key and
   secret.
3. Start it:

   ```sh
   npm install
   npm run dev
   ```

4. Open <http://localhost:3000> in two tabs, or on your phone too, and press
   **Build report** in one of them. Then try **Wait for the whole job** to
   compare.

`next dev` does not enforce `maxDuration`, so locally the blocking route
just waits the full 20 seconds; deployed to a serverless host it times out.

Jobs longer than your host allows for one function (`maxDuration`) belong
in a queue or background worker; publish from there with the same
`streamToChannel()` call.

## 中文摘要

一個要 20 秒才產生完的報告。舊做法是一個請求等整個工作做完，使用者只能看轉圈，而且常被 serverless 的時間限制以 504 中斷。新做法讓 API 立刻回應 202，用 `after()` 在背景繼續執行，並用 `streamToChannel()` 把每一行輸出送到 Hibira 頻道，所有開著的分頁和手機都會即時看到同樣的進度。
