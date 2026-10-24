# Push notifications in React Native (Expo)

An Expo app that registers for iOS and Android push notifications with
Hibira Push, subscribes to topics, and a script that sends to them.

| | |
|---|---|
| `lib/hibiraPush.ts` | A small client for the Hibira Push device API: register, interests, `setUserId`, `stop`. Copy it into your app. |
| `App.tsx` | Asks for permission, gets the native APNs or FCM token from `expo-notifications`, registers it and toggles topics. |
| `server/send.mjs` | Publishes to an interest with the official Beams Node SDK, pointed at Hibira. In your app this runs on your backend. |

Hibira delivers straight to APNs and FCM with the credentials you upload on
your app page, so the app sends its **native** device token
(`getDevicePushTokenAsync`), not an Expo push token, and Expo's push
service is not involved.

## Before you start

- A free app on [hibira.io](https://hibira.io/portal) with push turned on
  (app page → Push notifications).
- **Android:** a Firebase project. Upload its service account JSON on the
  app page, and put the Android app's `google-services.json` (package
  `io.hibira.examples.push`, or change it in `app.json`) next to `app.json`.
- **iOS:** an APNs key (`.p8`) uploaded on the app page, and an Apple
  developer account to run on a device.
- A real phone. Simulators and emulators can't receive push.

Expo Go can't receive these notifications; the example runs as a
development build.

## Run it

```sh
cp .env.example .env      # fill in the instance ID and, for sending, the secret key
npm install
npm run android           # or: npm run ios
```

Turn on **Product news** in the app, then send:

```sh
npm run send -- news "Hello" "Your first push notification."
```

## Signed-in users

To reach a user on all their devices with `publishToUsers`, link the device
after sign-in. Your backend makes a user token (`generateToken` in the
server SDKs, or the token route of
[hibira-io/laravel](https://github.com/hibira-io/laravel#signed-in-users)):

```ts
const { token } = await fetch(`${API}/push/user-token?user_id=${user.id}`, {
  headers: { Authorization: `Bearer ${session}` },
}).then((r) => r.json());

await push.setUserId(token);
```

Call `push.stop()` on sign-out so the device stops receiving that user's
notifications.

## Native apps

For Kotlin/Java and Swift apps, use
[hibira-push-android](https://github.com/hibira-io/hibira-push-android) and
[hibira-push-ios](https://github.com/hibira-io/hibira-push-ios), and for the
browser [@hibira-io/push-web](https://github.com/hibira-io/hibira-push-web).
