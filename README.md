# Hibira examples

Small, complete apps that use [Hibira](https://hibira.io) for realtime
messaging and push notifications. Each one runs with a free Hibira app
(no card) and has its own README.

| Example | Stack | Shows | Try it |
|---|---|---|---|
| [laravel-chat](laravel-chat) | Laravel 13, Echo, Vite | Presence rooms, broadcast events, typing indicators with client events | `php artisan serve` |
| [nextjs-dashboard](nextjs-dashboard) | Next.js 16, pusher-js | Server-side triggers, a live dashboard in every open tab, a large presence viewer count | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-dashboard?file=.env.example) |
| [nextjs-lobby](nextjs-lobby) | Next.js 16, @hibira-io/lobby | A playable multiplayer game: room list, seats, host, ready, chat, game events between browsers | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-lobby?file=.env.example) |
| [react-native-push](react-native-push) | Expo, expo-notifications | iOS and Android push: device registration, topics, signed-in users | Development build on a phone |

## Live demos

[hibira-io.github.io/examples](https://hibira-io.github.io/examples/) runs
nextjs-lobby and nextjs-dashboard in your browser, in seven languages. Open
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
- [@hibira-io/push-web](https://github.com/hibira-io/hibira-push-web),
  [hibira-push-android](https://github.com/hibira-io/hibira-push-android),
  [hibira-push-ios](https://github.com/hibira-io/hibira-push-ios): push
  notification SDKs

Something missing? [Open an issue](https://github.com/hibira-io/examples/issues).

## License

[MIT](LICENSE).
