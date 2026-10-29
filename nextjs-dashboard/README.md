# Live sales dashboard (Next.js)

A dashboard that updates in every open browser at once: KPIs, two charts,
an order feed and a live count of who is watching.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-dashboard?file=.env.example)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-dashboard&env=HIBIRA_APP_ID,HIBIRA_APP_SECRET,NEXT_PUBLIC_HIBIRA_APP_KEY&envDescription=App%20ID%2C%20secret%20and%20key%20from%20your%20Hibira%20app%20page%20%28the%20free%20plan%20is%20enough%29&envLink=https%3A%2F%2Fhibira.io%2Fportal&project-name=hibira-dashboard)

![Screenshot](screenshot.png)

## What it shows

- **Publishing from the server.** `app/api/tick/route.ts` calls
  `trigger()` from the [`pusher`](https://www.npmjs.com/package/pusher) Node
  SDK, pointed at Hibira with `host`. The secret never reaches the browser.
- **Subscribing in the browser.** `components/Dashboard.tsx` connects with
  [`pusher-js`](https://www.npmjs.com/package/pusher-js) to `ws.hibira.io`
  and updates on each `tick` event of the `dashboard` channel.
- **A large presence channel.** "Watching this dashboard" comes from
  `presence-large-dashboard-viewers` through
  [`@hibira-io/large-presence`](https://github.com/hibira-io/large-presence-js),
  which keeps an exact count from five viewers to 100,000.
- **Channel authorization.** `app/api/hibira/auth/route.ts` signs presence
  subscriptions. A real app checks its own session there.

## Run it

1. Create a free app on [hibira.io](https://hibira.io/portal) (no card) and
   open its page.
2. Copy `.env.example` to `.env.local` and fill in the app ID, key and
   secret.
3. Start it:

   ```sh
   npm install
   npm run dev
   ```

4. Open <http://localhost:3000>, press **Start simulator**, then open the
   same page in a second tab or on your phone. Every open dashboard moves
   together, and the viewer count goes up.

On StackBlitz, create `.env.local` in the file tree with the same values,
then restart the dev server from the terminal.

To put it online, press **Deploy with Vercel** at the top. Vercel copies
this folder into a new repository in your GitHub account and asks for the
app ID, secret and key. The API routes run as Vercel functions, and browsers
connect straight to Hibira, so nothing on Vercel holds a WebSocket open.

The simulator runs in the tab where you started it: that tab asks the
server to publish one made-up tick a second. In a real app the server
publishes when something happens (an order is paid, a job finishes).

## Use it with your own data

Replace `nextTick()` in `lib/metrics.ts` with your events and call
`hibira().trigger('dashboard', 'tick', data)` from wherever they happen: a
route handler, a server action, a queue worker or a webhook.

Events count against your plan's daily messages when published; each
delivery to a browser is free.
