import Pusher from 'pusher-js';
import { endpoint } from './demo';
import type { GameId } from './games';
import { loadPlayer } from './player';

export interface Config {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

/**
 * A connection for one game. Its auth requests carry the player's current ID
 * and name; with `perTab`, each tab is its own member, so two tabs of one
 * browser count as two painters.
 */
export function connect({ appKey, host, port, tls }: Config, game: GameId, perTab = false): Pusher {
  const tab = perTab ? `:${crypto.randomUUID().slice(0, 8)}` : '';
  return new Pusher(appKey, {
    cluster: 'hkg', // required by pusher-js, unused once wsHost is set
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS: tls,
    enabledTransports: ['ws', 'wss'],
    channelAuthorization: {
      endpoint: endpoint('/api/hibira/auth', `/${game}/auth`),
      transport: 'ajax',
      paramsProvider: () => {
        const p = loadPlayer();
        return { user_id: p.id + tab, name: p.name };
      },
    },
  });
}
