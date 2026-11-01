# 90-second demo script

**Layout:** the customer on the left, in a phone-width browser window. On the right, two manager windows, one above the other: Manager A and Manager B, each in its own browser or private window.

The demo UI is in Traditional Chinese. UI labels below are quoted in Chinese with the English meaning.

**Before you start** (not timed)

```sh
php artisan demo:reset          # DEMO-1042: USD 49.00 paid, nothing refunded
php artisan serve               # or: frankenphp php-server --listen 127.0.0.1:8000 --root public/
php artisan queue:work
```

**Setup:**
- In `.env`, set `DEMO_MODE=true`.
- In the Hibira app, add `http://localhost:8000` to Allowed origins.

**Sign in:** in each window, open `/login` and click a one-click login button:
- Customer: 「林小美（客戶）」
- Manager A: 「王經理」
- Manager B: 「陳主任」

Leave both manager windows on the AI approvals page (「AI 審批」).

| Time | Window | Action | Narration |
|---|---|---|---|
| 0:00–0:10 | All three | Point at the live-connection badge on the customer page and "1 other reviewer online" on the manager pages | "The customer is on the left and two managers are on the right. All three browsers are connected to Hibira, and the managers can see each other online." |
| 0:10–0:25 | Customer | Type 「我想退掉這筆訂單」 ("I'd like to return this order") and press Enter | "The customer asks for a refund. The support agent looks up the order and proposes refunding USD 49.00. Every refund needs a manager, so the agent pauses." |
| 0:25–0:35 | Both managers | Without a reload, the pending request appears in both inboxes | "Both inboxes get it at the same moment, with no reload. Above it is the order data from the backend: paid, refunded, refundable." |
| 0:35–0:45 | Manager B, then Manager A | Both open the request | "When both open the same request, each sees the other is reviewing it too, so nobody does half the work." |
| 0:45–1:00 | Manager A | Click Edit, change `"amount": 4900` to `2900`, run it with these arguments | "Manager A decides to refund only 29 dollars. The backend checks the amount, currency, order and what's left to refund. An invalid edit isn't accepted." |
| 1:00–1:15 | Customer | The reply streams in. The status turns completed; refunded USD 29.00, refundable USD 20.00 | "Once the decision is sent, the queue worker continues the same conversation, runs the simulated refund, and the customer gets the result live." |
| 1:15–1:25 | Manager B | The request turns done, decided by 王經理, with no buttons left | "Manager B sees the result too, and a decision that has been sent can't be overwritten by a second person." |
| 1:25–1:30 | Customer | Reload the page | "After a reload everything is still there. The order, the refund and the conversation live in our own database; Hibira only delivers the live updates." |

**Optional extras** (30 more seconds), pick one:
- **Refund operations:** Manager B opens the refund operations page and points out four things: the agent asked for USD 49.00, the actual refund was USD 29.00, 王經理 decided, and the refund reference.
- **Retry after a failure:** set `DEMO_MOCK_AI_FAILURE_AFTER_REFUND=true` in `.env` and run the flow again. After the failure, Retry in the inbox doesn't refund twice.

**Reproducing:**
- Run `php artisan demo:reset` before every demo.
- This release ships the script and the steps; **no video was recorded.**
- `tests/e2e/approval-flow.mjs` runs the same flow automatically. Set `E2E_SCREENSHOTS=<folder>` to keep a screenshot of each step.

## 中文摘要

**畫面配置**
- 左邊是客戶視窗，右邊上下兩個主管視窗。

**事前準備**
- 先執行 `demo:reset`，再啟動 Web 服務與 `queue:work`。
- 在三個視窗分別用一鍵登入：客戶、王經理、陳主任。

**90 秒流程**
1. 客戶說「我想退掉這筆訂單」。
2. 兩位主管同時收到請求，也看到彼此在線。
3. 王經理把金額改成 USD 29.00 後核准。
4. 客戶頁即時顯示已退款，陳主任的畫面也同步更新。
5. 重新整理頁面，狀態仍在。

**其他**
- 這一版沒有錄影片。E2E 測試會自動跑同樣的流程，也可以順便截圖。
