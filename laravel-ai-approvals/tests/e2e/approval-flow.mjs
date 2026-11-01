// Browser end-to-end test: one customer and two managers in three separate
// browser contexts, against a running app, queue worker and a real
// Pusher-protocol WebSocket server (a Hibira test app, or a local Hibira
// server). Nothing is faked here: events must arrive over the WebSocket.
//
//   BASE_URL=http://127.0.0.1:8000 node tests/e2e/approval-flow.mjs
//
// Needs: php artisan demo:reset, DEMO_MODE=true (one-click demo sign-in),
// php artisan queue:work, and Playwright (npx playwright install chromium).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8000';
const SHOTS = process.env.E2E_SCREENSHOTS; // optional folder for screenshots
const step = (text) => console.log(`- ${text}`);

const browser = await chromium.launch();
const contexts = [];

async function signIn(email, viewport) {
    const context = await browser.newContext({ viewport, locale: 'zh-TW' });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error(`[${email}] page error:`, e.message));
    await page.goto(`${BASE}/login`);
    await page.click(`[data-demo-user="${email}"]`);
    await page.waitForLoadState('networkidle');
    return page;
}

async function wsConnected(page) {
    await page.waitForFunction(() => window.Echo?.connector?.pusher?.connection?.state === 'connected', null, { timeout: 15000 });
}

async function shot(page, name) {
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

try {
    // --- Sign in: three independent browser contexts -----------------------
    const customer = await signIn('customer@demo.test', { width: 390, height: 844 });
    const managerA = await signIn('manager.a@demo.test', { width: 1280, height: 900 });
    const managerB = await signIn('manager.b@demo.test', { width: 1280, height: 900 });

    // Every Hibira frame the customer's browser receives, to prove the
    // updates come over the WebSocket and not from polling.
    const frames = [];
    customer.on('websocket', (ws) => ws.on('framereceived', ({ payload }) => frames.push(String(payload))));
    await customer.reload();
    await customer.waitForSelector('#connection[data-state="connected"]', { timeout: 15000 });
    step('customer page connected to the WebSocket server');

    for (const page of [managerA, managerB]) {
        assert.match(page.url(), /\/admin\/ai-approvals/);
        await wsConnected(page);
    }
    step('both managers have the AI approvals inbox open and connected');

    // Presence: each manager sees the other online.
    await managerA.waitForSelector('.ha-online:has-text("另有 1 位審查者在線上")', { timeout: 15000 });
    await managerB.waitForSelector('.ha-online:has-text("另有 1 位審查者在線上")', { timeout: 15000 });
    step('presence: each manager sees the other reviewer online');

    // --- The customer asks ---------------------------------------------------
    await customer.evaluate(() => (window.__noReload = true));
    await customer.fill('#body', '我想退掉這筆訂單');
    await customer.keyboard.press('Enter');
    await customer.waitForSelector('body[data-case-status="awaiting_approval"]', { timeout: 20000 });
    await customer.waitForSelector('#messages [data-role="agent"]:has-text("主管審批")');
    assert.equal(await customer.locator('#body').isDisabled(), true, 'composer is disabled while waiting');
    step('customer: the agent asked to refund USD 49.00 and the page says it waits for a manager');
    await shot(customer, '1-customer-waiting');

    // --- Both inboxes get it live --------------------------------------------
    for (const page of [managerA, managerB]) {
        await page.waitForSelector('.ha-item:has-text("Support Agent")', { timeout: 15000 });
    }
    step('both inboxes received the request without a reload');

    await managerB.click('.ha-item:has-text("Support Agent")');
    await managerA.click('.ha-item:has-text("Support Agent")');
    await managerA.waitForSelector('.ha-json:has-text("4900")');
    await managerA.waitForSelector('.ha-note:has-text("正在一起審查")', { timeout: 15000 });
    await managerB.waitForSelector('.ha-note:has-text("正在一起審查")', { timeout: 15000 });
    step('presence: each manager sees the other one looking at the same request');
    await managerA.waitForSelector('text=可退 USD 49.00');
    await shot(managerA, '2-manager-a-request');

    // --- Manager A lowers the amount to USD 29.00 and approves -----------
    await managerA.click('.ha-call button:has-text("修改")');
    const editor = managerA.locator('.ha-call textarea.is-code');
    const edited = JSON.parse(await editor.inputValue());
    edited.amount = 2900;
    await editor.fill(JSON.stringify(edited, null, 2));
    await managerA.click('.ha-call button:has-text("用這些參數執行")');
    step('manager A: edited the amount to 2900 (USD 29.00) and approved');

    // --- Everyone sees the result ------------------------------------------
    await customer.waitForSelector('body[data-case-status="completed"]', { timeout: 30000 });
    await customer.waitForSelector('#messages [data-role="agent"]:has-text("USD 29.00")');
    assert.equal(await customer.textContent('#order-refunded'), 'USD 29.00');
    assert.equal(await customer.textContent('#order-refundable'), 'USD 20.00');
    assert.equal(await customer.evaluate(() => window.__noReload), true, 'the customer page was not reloaded');
    step('customer: completed, refunded USD 29.00, the answer arrived live');
    await shot(customer, '3-customer-completed');

    for (const page of [managerA, managerB]) {
        await page.waitForSelector('.ha-main .ha-pill.is-resumed', { timeout: 20000 });
    }
    await managerB.waitForSelector('.ha-pill.is-edit:has-text("王經理")');
    step('both managers: the request shows as done, decided by manager A, without a reload');
    await shot(managerB, '4-manager-b-done');

    const events = frames.filter((f) => f.includes('"event":"case.updated"') || f.includes('"event":"agent.delta"'));
    assert.ok(events.some((f) => f.includes('agent.delta')), 'streamed text came over the WebSocket');
    assert.ok(events.some((f) => f.includes('case.updated')), 'status changes came over the WebSocket');
    step(`${events.length} case events arrived over the WebSocket (case.updated + agent.delta)`);

    // --- Manager B can't decide it again -----------------------------------
    assert.equal(await managerB.locator('.ha-call button:has-text("核准")').count(), 0, 'no decision buttons on a decided request');

    // --- Reload and reconnect restore from the backend ----------------------
    await customer.reload();
    await customer.waitForSelector('body[data-case-status="completed"]');
    assert.equal(await customer.textContent('#order-refunded'), 'USD 29.00');
    assert.equal(await customer.locator('#messages [data-role="agent"]').count(), 2);
    step('customer reload: same state from the backend');

    await customer.waitForSelector('#connection[data-state="connected"]', { timeout: 15000 });
    const snapshotFetched = customer.waitForResponse((r) => r.url().includes('/cases/') && r.request().method() === 'GET', { timeout: 15000 });
    await customer.evaluate(() => {
        window.Echo.connector.pusher.disconnect();
        setTimeout(() => window.Echo.connector.pusher.connect(), 300);
    });
    await snapshotFetched;
    await customer.waitForSelector('#connection[data-state="connected"]', { timeout: 15000 });
    step('customer reconnect: the page fetched the case snapshot again');

    // --- Refunds table in the panel -----------------------------------------
    await managerB.goto(`${BASE}/admin/refund-operations`);
    await managerB.waitForSelector('text=USD 29.00');
    await managerB.waitForSelector('text=USD 49.00');
    step('panel: the refund shows requested USD 49.00, final USD 29.00');
    await shot(managerB, '5-refund-operations');

    console.log('E2E passed');
} finally {
    for (const context of contexts) await context.close();
    await browser.close();
}
