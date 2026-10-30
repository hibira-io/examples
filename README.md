# Hibira examples

Small, complete apps that use [Hibira](https://hibira.io) for realtime
messaging and push notifications. Each one runs with a free Hibira app
(no card) and has its own README.

| Example | Stack | Shows | Try it |
|---|---|---|---|
| [godot-lobby](godot-lobby) | Godot 4, GDScript | The nextjs-lobby game in Godot, with the Hibira addon for Godot: rooms, chat, game events, cross-play with browser players | Open in Godot |
| [laravel-chat](laravel-chat) | Laravel 13, Echo, Vite | Presence rooms, broadcast events, typing indicators with client events | `php artisan serve` |
| [nextjs-dashboard](nextjs-dashboard) | Next.js 16, pusher-js | Server-side triggers, a live dashboard in every open tab, a large presence viewer count | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-dashboard?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-dashboard&env=HIBIRA_APP_ID,HIBIRA_APP_SECRET,NEXT_PUBLIC_HIBIRA_APP_KEY&envDescription=App%20ID%2C%20secret%20and%20key%20from%20your%20Hibira%20app%20page%20%28the%20free%20plan%20is%20enough%29&envLink=https%3A%2F%2Fhibira.io%2Fportal&project-name=hibira-dashboard) |
| [nextjs-games](nextjs-games) | Next.js 16, @hibira-io/lobby | Three small multiplayer games on client events: a shared pixel canvas, draw & guess, Connect Four | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-games?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-games&env=HIBIRA_APP_ID,HIBIRA_APP_SECRET,NEXT_PUBLIC_HIBIRA_APP_KEY&envDescription=App%20ID%2C%20secret%20and%20key%20from%20your%20Hibira%20app%20page%20%28the%20free%20plan%20is%20enough%29&envLink=https%3A%2F%2Fhibira.io%2Fportal&project-name=hibira-games) |
| [nextjs-lobby](nextjs-lobby) | Next.js 16, @hibira-io/lobby | A playable multiplayer game: room list, seats, host, ready, chat, game events between browsers | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-lobby?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-lobby&env=HIBIRA_APP_ID,HIBIRA_APP_SECRET,NEXT_PUBLIC_HIBIRA_APP_KEY&envDescription=App%20ID%2C%20secret%20and%20key%20from%20your%20Hibira%20app%20page%20%28the%20free%20plan%20is%20enough%29&envLink=https%3A%2F%2Fhibira.io%2Fportal&project-name=hibira-lobby) |
| [nextjs-spaces](nextjs-spaces) | Next.js 16, @hibira-io/spaces | A shared form: who's here, live cursors, field locks, follow mode | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-spaces?file=.env.example) [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhibira-io%2Fexamples%2Ftree%2Fmain%2Fnextjs-spaces&env=HIBIRA_APP_ID,HIBIRA_APP_SECRET,NEXT_PUBLIC_HIBIRA_APP_KEY&envDescription=App%20ID%2C%20secret%20and%20key%20from%20your%20Hibira%20app%20page%20%28the%20free%20plan%20is%20enough%29&envLink=https%3A%2F%2Fhibira.io%2Fportal&project-name=hibira-spaces) |
| [phaser-lobby](phaser-lobby) | Phaser 4, Vite, @hibira-io/lobby | The nextjs-lobby game in Phaser: rooms, chat, game events in a canvas, cross-play with browser and Godot players | `npm run dev` |
| [react-native-push](react-native-push) | Expo, expo-notifications | iOS and Android push: device registration, topics, signed-in users | Development build on a phone |

The Next.js examples also deploy to Netlify (button in each README),
Render (`render.yaml`, nextjs-dashboard) and Zeabur (`deploy/zeabur/`).
On a hosted copy, add its address to the app's **Allowed origins** on
hibira.io.

## Live demos

[demos.hibira.io/examples](https://demos.hibira.io/examples/) runs
nextjs-lobby, nextjs-dashboard, nextjs-spaces, nextjs-games and phaser-lobby in your browser, in seven languages. Open
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
