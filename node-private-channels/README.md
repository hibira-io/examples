# Private and end-to-end encrypted channels

A delivery-tracking page for order #1042, sent three ways so you can see
the difference:

| Channel | Who can subscribe | What Hibira relays |
|---|---|---|
| `order-1042` | Anyone with your app key and the channel name | Readable JSON |
| `private-order-1042` | Only users your `/pusher/auth` endpoint signs for | Readable JSON |
| `private-encrypted-order-1042` | Same as private | Ciphertext only (NaCl secretbox) |

Your app key is in every page's source, and channel names like
`order-1042` are easy to guess, so a public channel is readable by anyone.
Put anything personal on a private channel, and when even the relay should
not read it, on a `private-encrypted-` channel.

## Run it

1. Create a free app at [hibira.io](https://hibira.io/portal) and add
   `http://localhost:3000` to its **Allowed origins**.
2. `cp .env.example .env`, fill in the app ID, key and secret, and set
   `HIBIRA_ENCRYPTION_MASTER_KEY` to the output of `openssl rand -base64 32`.
3. `npm install && npm start` (Node 20.6 or later).
4. Open two windows side by side:
   - Alice, who owns the order: <http://localhost:3000/?channel=public&as=alice>
   - Someone else: <http://localhost:3000/?channel=public&as=guest>
5. Click **Send an order update**. Both windows show Alice's address.
   Change `channel=public` to `private` or `encrypted` in both windows and
   send again: the other visitor's subscription is rejected with 403, and on
   the encrypted channel the raw frame is ciphertext that only Alice's
   browser can decrypt.

## Where to look

- `server.mjs`: `authorize()` signs a subscription only for the order's
  owner; `encryptionMasterKeyBase64` turns on end-to-end encryption for
  `private-encrypted-` channels.
- `public/app.js`: `channelAuthorization` points pusher-js at the auth
  endpoint; `pusher:subscription_error` shows the rejection. The page loads
  the `pusher-js/with-encryption` build, which decrypts in the browser.

The `X-Demo-User` header stands in for sign-in. In your app, read the user
from your session in the auth endpoint instead.

Node guide: [hibira.io/guides/node](https://hibira.io/guides/node)

## 中文摘要

同一張訂單用三種頻道送出：公開頻道任何知道 app key 與頻道名稱的人都能訂閱；
`private-` 頻道只有通過你伺服器 `/pusher/auth` 授權的使用者能訂閱，其他人會收到 403；
`private-encrypted-` 頻道再加上端對端加密，Hibira 只轉送密文，只有瀏覽器端能解密。
依上面步驟設定 `.env` 後執行 `npm start`，開兩個視窗比較。
