# Order alerts with web push

A shop's orders page that notifies the owner about every new order, even
when the page is closed. The browser registers with Hibira Push, and the
server publishes one notification per order to the `orders` interest. The
same call carries APNs and FCM payloads, so iOS and Android apps registered
on `orders` get it too.

| | |
|---|---|
| `public/service-worker.js` | Loads the Hibira Push service worker, which shows notifications while no tab is open. |
| `public/app.js` | "Turn on order alerts": `start()` registers the browser, `addDeviceInterest('orders')` subscribes it. |
| `server.mjs` | `onOrderCreated()` publishes to `orders` with the official Beams Node SDK, pointed at Hibira. |
| `public/shop.html` | A one-product checkout to place test orders. |

## Run it

1. Create a free app on [hibira.io](https://hibira.io/portal), open
   **Push notifications** on the app page and turn push on.
2. Copy the instance ID and the secret key into `.env`:

   ```sh
   cp .env.example .env
   npm install
   npm start
   ```

3. Open <http://localhost:3000>, click **Turn on order alerts** and allow
   notifications. Close the tab.
4. Open <http://localhost:3000/shop.html> (on your phone or another
   browser) and place an order. The notification arrives on the first
   browser.

Web push needs `https`, or `localhost` while developing. On a hosted copy,
serve it over https; nothing else changes.

## 中文摘要

網店的訂單頁面：店主按「Turn on order alerts」後，瀏覽器向 Hibira Push 註冊並訂閱 `orders`。每筆新訂單由伺服器呼叫一次 `publishToInterests`，就算訂單頁面關掉了，通知也會出現；同一個請求也帶著 APNs 和 FCM 內容，iOS、Android App 一樣收得到。在 hibira.io 的 App 頁面開啟推播，把 instance ID 和 secret key 填進 `.env`，執行 `npm start` 即可。
