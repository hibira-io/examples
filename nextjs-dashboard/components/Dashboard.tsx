'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { LargePresence } from '@hibira-io/large-presence';
import { CHANNEL, VIEWERS_CHANNEL, type Order, type Tick } from '@/lib/metrics';
import Sparkline from './Sparkline';

const WINDOW = 60; // seconds shown in the charts
const FEED = 12; // orders shown in the feed

type State = 'connecting' | 'connected' | 'unavailable' | 'failed' | 'disconnected' | 'initialized';

interface Props {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

export default function Dashboard({ appKey, host, port, tls }: Props) {
  const [connection, setConnection] = useState<State>('connecting');
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [feed, setFeed] = useState<Order[]>([]);
  const [viewers, setViewers] = useState<number | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = useRef({ orders: 0, revenue: 0 });
  const [, rerender] = useState(0);

  useEffect(() => {
    const pusher = new Pusher(appKey, {
      cluster: 'hkg', // required by pusher-js, unused once wsHost is set
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: tls,
      enabledTransports: ['ws', 'wss'],
      channelAuthorization: { endpoint: '/api/hibira/auth', transport: 'ajax' },
    });
    pusher.connection.bind('state_change', ({ current }: { current: State }) => setConnection(current));

    pusher.subscribe(CHANNEL).bind('tick', (tick: Tick) => {
      setTicks((prev) => [...prev, tick].slice(-WINDOW));
      if (tick.orders.length) {
        setFeed((prev) => [...tick.orders.slice().reverse(), ...prev].slice(0, FEED));
        totals.current.orders += tick.orders.length;
        totals.current.revenue += tick.orders.reduce((sum, o) => sum + o.amount, 0);
        rerender((n) => n + 1);
      }
    });

    // Everyone with the dashboard open, counted by Hibira. A large presence
    // channel sends the count and batched joins and leaves, so it works the
    // same with 5 viewers or 50,000.
    const room = LargePresence.subscribe(pusher, VIEWERS_CHANNEL);
    room.on('ready', ({ count }) => setViewers(count));
    room.on('change', ({ count }) => setViewers(count));

    return () => {
      room.unsubscribe();
      pusher.disconnect();
    };
  }, [appKey, host, port, tls]);

  // The simulator asks the server to publish one tick a second. Open the
  // page in a second tab: both update, only one needs the simulator on.
  useEffect(() => {
    if (!simulating) return;
    const timer = setInterval(async () => {
      const res = await fetch('/api/tick', { method: 'POST' });
      if (!res.ok) {
        setError(`Publishing failed (${res.status}). Check HIBIRA_APP_ID and HIBIRA_APP_SECRET.`);
        setSimulating(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [simulating]);

  const visitors = useMemo(() => ticks.map((t) => t.visitors), [ticks]);
  const ordersPerTick = useMemo(() => ticks.map((t) => t.orders.length), [ticks]);
  const last = ticks.at(-1);

  return (
    <main className="dashboard">
      <header>
        <div>
          <h1>Live sales</h1>
          <p className="muted">
            Realtime over <code>{host}</code>
          </p>
        </div>
        <div className="actions">
          <span className={`status status-${connection}`}>{connection}</span>
          <button
            type="button"
            className={simulating ? 'secondary' : 'primary'}
            onClick={() => {
              setError(null);
              setSimulating((s) => !s);
            }}
          >
            {simulating ? 'Stop simulator' : 'Start simulator'}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {!simulating && ticks.length === 0 && (
        <p className="hint">
          Start the simulator, then open this page in a second tab or on your phone: every open dashboard updates
          from the same events.
        </p>
      )}

      <section className="kpis">
        <Kpi label="Visitors on the shop" value={last ? last.visitors.toLocaleString() : '–'} />
        <Kpi label="Orders" value={totals.current.orders.toLocaleString()} />
        <Kpi label="Revenue" value={`$${totals.current.revenue.toLocaleString()}`} />
        <Kpi label="Watching this dashboard" value={viewers === null ? '–' : viewers.toLocaleString()} />
      </section>

      <section className="charts">
        <div className="card">
          <h2>Visitors, last {WINDOW} s</h2>
          <Sparkline values={visitors} />
        </div>
        <div className="card">
          <h2>Orders per second</h2>
          <Sparkline values={ordersPerTick} bars />
        </div>
      </section>

      <section className="card">
        <h2>Latest orders</h2>
        {feed.length === 0 ? (
          <p className="muted">No orders yet.</p>
        ) : (
          <ul className="feed">
            {feed.map((o) => (
              <li key={o.id}>
                <span>{o.city}</span>
                <span className="muted">{o.plan}</span>
                <span className="amount">${o.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card kpi">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
