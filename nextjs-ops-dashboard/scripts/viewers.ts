import Pusher from 'pusher-js';
import { LargePresence } from '@hibira-io/large-presence';
import { STATS_CHANNEL, VIEWERS_CHANNEL } from '../lib/channels';
import { host, port, tls } from '../lib/hibira';

// Opens N dashboards without a browser, so you can watch what happens to
// Postgres at 200 viewers. Usage:
//   npm run viewers -- poll 200 [ramp seconds]
//   npm run viewers -- push 200 [ramp seconds]
const [mode = 'poll', countArg = '50', rampArg = '0'] = process.argv.slice(2);
const count = Number(countArg);
const rampMs = Number(rampArg) * 1000;
const base = process.env.DASHBOARD_URL || 'http://localhost:3000';

let answered = 0;
let worstAge = 0;

function pollingViewer() {
  setInterval(async () => {
    const res = await fetch(`${base}/api/stats`).catch(() => null);
    if (!res?.ok) return;
    const stats = await res.json();
    answered++;
    worstAge = Math.max(worstAge, Date.now() - stats.at);
  }, 1000);
}

function pushViewer() {
  const pusher = new Pusher(process.env.NEXT_PUBLIC_HIBIRA_APP_KEY!, {
    cluster: 'hkg',
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: tls,
    enabledTransports: ['ws', 'wss'],
    channelAuthorization: { endpoint: `${base}/api/hibira/auth`, transport: 'ajax' },
  });
  pusher.subscribe(STATS_CHANNEL).bind('stats', (stats: { at: number }) => {
    answered++;
    worstAge = Math.max(worstAge, Date.now() - stats.at);
  });
  LargePresence.subscribe(pusher, VIEWERS_CHANNEL);
}

for (let i = 0; i < count; i++) {
  setTimeout(mode === 'push' ? pushViewer : pollingViewer, rampMs ? (rampMs * i) / count : i * 5);
}

setInterval(() => {
  console.log(`${mode}: ${count} viewers, ${answered} updates/s, oldest data ${(worstAge / 1000).toFixed(1)} s`);
  answered = 0;
  worstAge = 0;
}, 1000);
