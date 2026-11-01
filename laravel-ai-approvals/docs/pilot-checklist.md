# Pilot checklist

For teams who want to use this example to find early users. The numbers below are **experiment thresholds** for deciding whether to keep investing. They are not results that have been reached.

> 中文摘要在最後：[中文摘要](#中文摘要)。

## Experiment thresholds (not yet verified)

| Metric | Threshold | Definition |
|---|---|---|
| Developers who tried it | 10 | Ran the refund approval flow once on their own machine or server and saw the customer page show the refund |
| Wired into real projects | 3 | Added `ApprovalDesk`, an approval tool or the Hibira channels to a Laravel project that isn't this demo |
| Still in use after two weeks | 2 | On day 14 after integration, the project had approval events in the previous 7 days |
| Paid pilot | 1 | A signed paid pilot or an upgrade to a paid plan, with approvals as the reason |

We suggest a 6-week observation window. If the thresholds aren't met by the end, first find the step where people dropped off. Then decide whether to change the example, change the packages, or stop.

## Onboarding checklist (each pilot user)

- [ ] Get a free Hibira app, fill in `HIBIRA_*` in `.env`, and add the address to Allowed origins
- [ ] Start it with `docker compose up` (FrankenPHP image), or locally with `php artisan serve` + `php artisan queue:work`
- [ ] Create the demo data with `php artisan demo:reset`
- [ ] The customer sends 「我想退掉這筆訂單」, and the request appears in both manager inboxes at once, with each manager seeing the other online
- [ ] One manager approves at USD 29.00, and the other's view updates and can no longer decide
- [ ] The customer page shows the result live and the same state after a reload
- [ ] Stop the worker and start it again, and nothing is lost
- [ ] (Optional) Switch to a real model with `AI_PROVIDER=...` and run `php artisan demo:smoke`
- [ ] Note how many minutes it took from clone to the first successful refund (target under 30 minutes; not yet measured)

## Interview questions

1. Which actions do you let AI take today that need a person to confirm? How do you confirm them now?
2. Where do the approvers usually work (an admin panel, Slack, their phone)?
3. Which step took longest? Which part of the instructions was unclear?
4. Which do you really need: editing amounts, rejection reasons, several approvers at once?
5. What's missing before you'd put it in production (audit log, roles, expiry, push)?
6. If this were a paid feature, what budget or process would you buy it through?

## How to measure

- **Tried and integrated:** ask the pilot user to report it, or check the Hibira console for `private-hibira-approvals.*` channels on their app.
- **Still in use:** the same app has approval channel activity on days 8 to 14.
- **Consent:** the example contains no telemetry, and every measurement needs the pilot user's consent.

## 中文摘要

**實驗門檻**
- 門檻是：10 位開發者試用、3 個專案接入、2 個兩週後仍在使用、1 個付費試點。
- 這些只是用來決定要不要繼續投入的實驗門檻，不是已經達成的成果。
- 建議觀察 6 週。

**清單內容**
- 上手檢查：從取得 app 到跑完整個流程，並記錄花了多少分鐘（目標 30 分鐘內，尚未量測）。
- 訪談問題。
- 量測方式。

**隱私**
- 範例不含任何遙測，所有量測都要試用者同意。
