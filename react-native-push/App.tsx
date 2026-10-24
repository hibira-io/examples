import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { HibiraPush } from './lib/hibiraPush';

const INSTANCE_ID = process.env.EXPO_PUBLIC_HIBIRA_PUSH_INSTANCE_ID ?? '';
const ENDPOINT = process.env.EXPO_PUBLIC_HIBIRA_PUSH_ENDPOINT || 'https://ws.hibira.io';
const TOPICS = [
  { interest: 'news', label: 'Product news' },
  { interest: 'deals', label: 'Deals' },
  { interest: 'status', label: 'Service status' },
];

const push = new HibiraPush({ instanceId: INSTANCE_ID, endpoint: ENDPOINT });

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Status = { state: 'starting' } | { state: 'ready'; deviceId: string } | { state: 'error'; message: string };

export default function App() {
  const [status, setStatus] = useState<Status>({ state: 'starting' });
  const [interests, setInterests] = useState<string[]>([]);
  const [last, setLast] = useState<Notifications.Notification | null>(null);

  function connect() {
    setStatus({ state: 'starting' });
    register().then(
      async (deviceId) => {
        setStatus({ state: 'ready', deviceId });
        setInterests(await push.getInterests());
      },
      (e: Error) => setStatus({ state: 'error', message: e.message }),
    );
  }

  useEffect(() => {
    connect();
    const sub = Notifications.addNotificationReceivedListener(setLast);
    return () => sub.remove();
  }, []);

  async function toggle(interest: string, on: boolean) {
    setInterests((prev) => (on ? [...prev, interest] : prev.filter((i) => i !== interest)));
    try {
      await (on ? push.addInterest(interest) : push.removeInterest(interest));
    } catch (e) {
      setInterests(await push.getInterests());
      setStatus({ state: 'error', message: (e as Error).message });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Hibira Push</Text>
      <Text style={styles.muted}>React Native example</Text>

      <View style={styles.card}>
        <Text style={styles.heading}>This device</Text>
        {status.state === 'starting' && <ActivityIndicator />}
        {status.state === 'ready' && (
          <>
            <Text>Registered ({Platform.OS === 'ios' ? 'APNs' : 'FCM'})</Text>
            <Text selectable style={styles.mono}>
              {status.deviceId}
            </Text>
          </>
        )}
        {status.state === 'error' && <Text style={styles.error}>{status.message}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Topics</Text>
        {TOPICS.map(({ interest, label }) => (
          <View key={interest} style={styles.row}>
            <Text>{label}</Text>
            <Switch
              disabled={status.state !== 'ready'}
              value={interests.includes(interest)}
              onValueChange={(on) => toggle(interest, on)}
            />
          </View>
        ))}
        <Text style={styles.muted}>
          Send one with <Text style={styles.mono}>npm run send -- news</Text>.
        </Text>
      </View>

      {last && (
        <View style={styles.card}>
          <Text style={styles.heading}>Last notification</Text>
          <Text style={styles.bold}>{last.request.content.title}</Text>
          <Text>{last.request.content.body}</Text>
        </View>
      )}

      {status.state === 'error' && (
        <Pressable style={styles.button} onPress={connect}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

/** Asks for permission, gets the native APNs/FCM token and registers it with Hibira. */
async function register(): Promise<string> {
  if (!INSTANCE_ID) {
    throw new Error('Set EXPO_PUBLIC_HIBIRA_PUSH_INSTANCE_ID in .env and restart Expo.');
  }
  if (!Device.isDevice) {
    throw new Error('Push notifications need a real device, not a simulator or emulator.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) {
    throw new Error('Notifications are turned off for this app in system settings.');
  }

  // The native token, not an Expo push token: Hibira sends straight to
  // APNs and FCM with the credentials on your app page.
  const { type, data } = await Notifications.getDevicePushTokenAsync();
  return push.start(type === 'ios' ? 'apns' : 'fcm', String(data));
}

const styles = StyleSheet.create({
  page: { padding: 24, paddingTop: 72, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 13, fontWeight: '600', color: '#646a7d', textTransform: 'uppercase' },
  muted: { color: '#646a7d' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: 12 },
  bold: { fontWeight: '600' },
  error: { color: '#d23c3c' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 8, borderWidth: 1, borderColor: '#e3e6ef' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  button: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: '#5b4bff' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
