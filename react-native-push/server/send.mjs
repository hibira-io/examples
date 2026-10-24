// Sends a notification to every device subscribed to an interest:
//   npm run send -- news "Hello" "Sent from Hibira"
// Reads EXPO_PUBLIC_HIBIRA_PUSH_INSTANCE_ID, EXPO_PUBLIC_HIBIRA_PUSH_ENDPOINT
// and HIBIRA_PUSH_SECRET_KEY from .env. In your app, this code lives on
// your backend.
import PushNotifications from '@pusher/push-notifications-server';

try {
  process.loadEnvFile('.env');
} catch {
  // no .env: use the environment as is
}

const [interest = 'news', title = 'Hello from Hibira', body = 'Your first push notification.'] = process.argv.slice(2);
const endpoint = new URL(process.env.EXPO_PUBLIC_HIBIRA_PUSH_ENDPOINT || 'https://ws.hibira.io');

const push = new PushNotifications({
  instanceId: process.env.EXPO_PUBLIC_HIBIRA_PUSH_INSTANCE_ID,
  secretKey: process.env.HIBIRA_PUSH_SECRET_KEY,
  endpoint: endpoint.hostname, // host only; the SDK takes no port
});
// The SDK switches to http when an endpoint is set.
push.protocol = endpoint.protocol.replace(':', '');

const res = await push.publishToInterests([interest], {
  apns: { aps: { alert: { title, body }, sound: 'default' } },
  fcm: { notification: { title, body } },
});
console.log(`Published ${res.publishId} to "${interest}"`);
