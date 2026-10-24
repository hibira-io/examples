# Hibira examples

Small, complete apps that use [Hibira](https://hibira.io) for realtime
messaging and push notifications. Each one runs with a free Hibira app
(no card) and has its own README.

| Example | Stack | Shows | Try it |
|---|---|---|---|
| [laravel-chat](laravel-chat) | Laravel 13, Echo, Vite | Presence rooms, broadcast events, typing indicators with client events | `php artisan serve` |
| [nextjs-dashboard](nextjs-dashboard) | Next.js 16, pusher-js | Server-side triggers, a live dashboard in every open tab, a large presence viewer count | [![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz_small.svg)](https://stackblitz.com/github/hibira-io/examples/tree/main/nextjs-dashboard?file=.env.example) |
| [react-native-push](react-native-push) | Expo, expo-notifications | iOS and Android push: device registration, topics, signed-in users | Development build on a phone |

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
- [@hibira-io/push-web](https://github.com/hibira-io/hibira-push-web),
  [hibira-push-android](https://github.com/hibira-io/hibira-push-android),
  [hibira-push-ios](https://github.com/hibira-io/hibira-push-ios): push
  notification SDKs

Something missing? [Open an issue](https://github.com/hibira-io/examples/issues).

## License

[MIT](LICENSE).
