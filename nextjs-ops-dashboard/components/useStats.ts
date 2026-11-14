'use client';

import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { LargePresence } from '@hibira-io/large-presence';
import { STATS_CHANNEL, VIEWERS_CHANNEL } from '@/lib/channels';
import type { Stats } from '@/lib/db';

export interface Live {
  stats: Stats | null;
  /** How many people have the dashboard open, or null when unknown. */
  viewers: number | null;
}

export interface Connection {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

// Before: every open dashboard asks the database once a second.
export function usePolling(): Live {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch('/api/stats');
      setStats(await res.json());
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return { stats, viewers: null };
}

// After: the server queries once a second and Hibira pushes the result here.
export function usePush({ appKey, host, port, tls }: Connection): Live {
  const [stats, setStats] = useState<Stats | null>(null);
  const [viewers, setViewers] = useState<number | null>(null);
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
    pusher.subscribe(STATS_CHANNEL).bind('stats', setStats);

    // Who is watching: an exact count from 5 viewers to 100,000.
    const room = LargePresence.subscribe(pusher, VIEWERS_CHANNEL);
    room.on('ready', ({ count }) => setViewers(count));
    room.on('change', ({ count }) => setViewers(count));

    return () => pusher.disconnect();
  }, [appKey, host, port, tls]);
  return { stats, viewers };
}
