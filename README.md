# Hibira examples

Small, complete apps that use [Hibira](https://hibira.io) for realtime
messaging and push notifications. Each one runs with a free Hibira app
(no card) and has its own README.

| Example | Stack | Shows | Try it |
|---|---|---|---|
| [express-ticket-drop](express-ticket-drop) | Express 5, @hibira-io/waiting-room | A ticket drop under a 3,000-buyer load test: a plain checkout oversells and times out, the same rush behind a waiting room sells exactly the seats on sale | `npm start` + `npm run flood` |
| [godot-lobby](godot-lobby) | Godot 4, GDScript | The nextjs-lobby game in Godot, with the Hibira addon for Godot: rooms, chat, game events, cross-play with browser players | Open in Godot |
| [laravel-ai-approvals](laravel-ai-approvals) | Laravel 13, Filament 5, Laravel AI SDK, PostgreSQL | An AI support agent asks for a refund; two managers see it live with presence, approve, edit or reject; the agent resumes from the queue and the customer sees the result | `php artisan serve` + `php artisan queue:work`, or `docker compose up` |
| [laravel-chat](laravel-chat) | Laravel 13, Echo, Vite | Presence rooms, broadcast events, typing indicators with client events | `php artisan serve` |
| [nextjs-auction](nextjs-auction) | Next.js 16, @hibira-io/auction | A game auction house: live listings and bids, countdowns on the server clock, last-seconds extension, buy now, settlement into the player's bag | `npm run dev` |
| [nextjs-dashboard](nextjs-dashboard) | Next.js 16, pusher-js | Server-side triggers, a live dashboard in every open tab, a large presence viewer count | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-dashboard?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-dashboard&integration-ids=oac_BDiFKkVaaw4jAnV7wOcdMBUe&project-name=hibira-dashboard) |
| [nextjs-ops-dashboard](nextjs-ops-dashboard) | Next.js 16, Postgres, pusher-js | An ops dashboard two ways: every viewer polling Postgres, or one query a second pushed to everyone, plus a large presence viewer count and a load script for 200 viewers | `npm start` + `npm run publisher` |
| [nextjs-games](nextjs-games) | Next.js 16, @hibira-io/lobby | Three small multiplayer games on client events: a shared pixel canvas, draw & guess, Connect Four | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-games?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-games&integration-ids=oac_BDiFKkVaaw4jAnV7wOcdMBUe&project-name=hibira-games) |
| [nextjs-handoff](nextjs-handoff) | Next.js 16, pusher-js, WebRTC | Phone to desktop: scan a QR code, take a photo on the phone, it lands in the desktop form. End-to-end encrypted, WebRTC with a client-event relay | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-handoff?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-handoff&integration-ids=oac_BDiFKkVaaw4jAnV7wOcdMBUe&project-name=hibira-handoff) |
| [nextjs-invite-queue](nextjs-invite-queue) | Next.js 16, pusher-js | Queue for invite codes with a chat room: email sign-in, live queue position and online count, each given code offered to the next person in line for 6 hours, private "your turn" events | [hibira.io/tools/invite-queue](https://hibira.io/tools/invite-queue/) |
| [nextjs-long-jobs](nextjs-long-jobs) | Next.js 16, @hibira-io/react | A slow report streamed line by line to every open tab: the route answers at once, the job runs in `after()` and `streamToChannel()` publishes its output, next to the old spinner-and-504 way | `npm run dev` |
| [nextjs-lobby](nextjs-lobby) | Next.js 16, @hibira-io/lobby | A playable multiplayer game: room list, seats, host, ready, chat, game events between browsers | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-lobby?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-lobby&integration-ids=oac_BDiFKkVaaw4jAnV7wOcdMBUe&project-name=hibira-lobby) |
| [nextjs-spaces](nextjs-spaces) | Next.js 16, @hibira-io/spaces | A shared form: who's here, live cursors, field locks, follow mode | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-spaces?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-spaces&integration-ids=oac_BDiFKkVaaw4jAnV7wOcdMBUe&project-name=hibira-spaces) |
| [nextjs-sql-approvals](nextjs-sql-approvals) | Next.js 16, @hibira-io/approvals, sql.js | Reads run at once; a database change waits until a supervisor approves its exact SQL, estimated rows and SHA-256 on the Hibira-hosted page, and runs once when the answer arrives on a private channel | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-sql-approvals?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-sql-approvals&integration-ids=oac_BDiFKkVaaw4jAnV7wOcdMBUe&project-name=hibira-sql-approvals) |
| [node-private-channels](node-private-channels) | Node.js, pusher-js | One order sent on a public, a private and an end-to-end encrypted channel: who can subscribe, the 403 for everyone else, and the ciphertext Hibira relays | `npm start` |
| [open-webui-tool](open-webui-tool) | Open WebUI, Python | A tool that lets the model hand Live Chat conversations to a person, send push notifications and ask a person to approve before it acts | Paste into Workspace → Tools |
| [phaser-lobby](phaser-lobby) | Phaser 4, Vite, @hibira-io/lobby | The nextjs-lobby game in Phaser: rooms, chat, game events in a canvas, cross-play with browser and Godot players | `npm run dev` |
| [react-native-push](react-native-push) | Expo, expo-notifications | iOS and Android push: device registration, topics, signed-in users | Development build on a phone |

The Next.js examples also deploy to Netlify (button in each README),
Render (`render.yaml`, nextjs-dashboard) and Zeabur (`deploy/zeabur/`).
On a hosted copy, add its address to the app's **Allowed origins** on
hibira.io.

## Live demos

[demos.hibira.io/examples](https://demos.hibira.io/examples/) runs
nextjs-handoff, nextjs-lobby, nextjs-dashboard, nextjs-spaces, nextjs-games, nextjs-sql-approvals, nextjs-auction and phaser-lobby in your browser, in seven languages. Open
a demo in two tabs, or send its link to a friend, to see it sync. They are
these same apps built as static pages (`.github/workflows/pages.yml`):
with `NEXT_PUBLIC_DEMO_API` set, `next build` exports only the
`*.demo.tsx` routes, and the auth and server calls go to Hibira's demo
backend instead of the app's own API routes, which need your secret.

## Get credentials

1. Sign up at [hibira.io](https://hibira.io/portal) and create an app.
2. Copy the app ID, key and secret from the app page (and, for push, the
   instance ID and secret key from Push notifications).
3. Put them in the example's `.env` file as its README says.

Or create the app with Terraform: [terraform](terraform) makes one app for
every example and prints each example's `.env`.

Hibira speaks the Pusher Channels and Beams protocols, so these examples use
the standard open-source clients (`pusher-js`, `laravel-echo`,
`pusher-php-server`) with the host set to `ws.hibira.io`, plus Hibira's own
packages:

- [hibira-io/laravel](https://github.com/hibira-io/laravel): Laravel
  broadcasting, push notifications and webhooks
- [@hibira-io/large-presence](https://github.com/hibira-io/large-presence-js):
  presence channels with up to 100,000 members
- [@hibira-io/lobby](https://github.com/hibira-io/lobby-js): game rooms and
  lobbies on presence channels
- [@hibira-io/auction](https://github.com/hibira-io/auction-js): a realtime
  auction house for games, with your server as the authority
- [@hibira-io/spaces](https://github.com/hibira-io/spaces-js): who's online,
  live cursors, component locks and follow mode on presence channels
- [hibira-io/godot](https://github.com/hibira-io/godot): a Pusher protocol
  client and game rooms in GDScript, for Godot 4
- [@hibira-io/push-web](https://github.com/hibira-io/hibira-push-web),
  [hibira-push-android](https://github.com/hibira-io/hibira-push-android),
  [hibira-push-ios](https://github.com/hibira-io/hibira-push-ios): push
  notification SDKs

Something missing? [Open an issue](https://github.com/hibira-io/examples/issues).

## License

[MIT](LICENSE).
