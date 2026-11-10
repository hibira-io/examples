import Pusher from 'pusher-js';
import { endpoint } from './demo';
import type { Role } from '@hibira-io/handoff';

export interface Config {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

/** A pusher-js client whose presence auth carries this page's role and device name. */
export function connect(c: Config, me: string, role: Role, device: string): Pusher {
  return new Pusher(c.appKey, {
    cluster: 'hkg', // required by pusher-js, unused once wsHost is set
    wsHost: c.host,
    wsPort: c.port,
    wssPort: c.port,
    forceTLS: c.tls,
    enabledTransports: ['ws', 'wss'],
    channelAuthorization: {
      endpoint: endpoint('/api/hibira/auth', '/handoff/auth'),
      transport: 'ajax',
      params: { user_id: me, role, device },
    },
  });
}

/** Raw bytes per relayed chunk. 2700 fits the free plan's 4 KB event limit; the hosted demo's plan allows 10 KB. */
export const RELAY_CHUNK = Number(process.env.NEXT_PUBLIC_RELAY_CHUNK_BYTES) || 2700;
