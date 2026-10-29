import Pusher from 'pusher-js';
import { randomInt } from './random';

// Connection settings and the backend's endpoints. Locally they come from
// .env.local and nextjs-lobby (through the dev server's /api proxy); a hosted
// demo build (VITE_DEMO_API set) gets them from Hibira's demo backend.

export const DEMO_API = import.meta.env.VITE_DEMO_API ?? '';

export const SOURCE_URL = 'https://github.com/hibira-io/examples/tree/main/phaser-lobby';

export interface Config {
  key: string;
  host: string;
  port: number;
  tls: boolean;
}

export async function loadConfig(): Promise<Config | null> {
  if (DEMO_API) {
    const r = await fetch(`${DEMO_API}/config`);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }
  const key = import.meta.env.VITE_HIBIRA_APP_KEY;
  if (!key) return null;
  return {
    key,
    host: import.meta.env.VITE_HIBIRA_HOST || 'ws.hibira.io',
    port: Number(import.meta.env.VITE_HIBIRA_PORT || 443),
    tls: (import.meta.env.VITE_HIBIRA_SCHEME || 'https') === 'https',
  };
}

/** nextjs-lobby's route, or the demo backend's when built as a hosted demo. */
export function endpoint(local: string, demo: string): string {
  return DEMO_API ? DEMO_API + demo : local;
}

export interface Player {
  id: string;
  name: string;
}

const NAMES = ['Aiko', 'Bao', 'Chen', 'Dara', 'Emi', 'Farid', 'Ga-eun', 'Hana', 'Indra', 'Jun'];

// The player's ID and name live in this browser only, under the same key as
// nextjs-lobby. A real game has a signed-in user instead.
export function loadPlayer(): Player {
  try {
    const saved = JSON.parse(localStorage.getItem('player') ?? 'null');
    if (saved?.id && saved?.name) return saved;
  } catch {}
  return { id: crypto.randomUUID(), name: NAMES[randomInt(NAMES.length)] };
}

export function savePlayer(p: Player) {
  try {
    localStorage.setItem('player', JSON.stringify(p));
  } catch {}
}

let pusher: Pusher | undefined;

/** One connection for the whole game; each room's auth request carries the player's current name. */
export function connect(config: Config): Pusher {
  pusher ??= new Pusher(config.key, {
    cluster: 'hkg', // required by pusher-js, unused once wsHost is set
    wsHost: config.host,
    wsPort: config.port,
    wssPort: config.port,
    forceTLS: config.tls,
    enabledTransports: ['ws', 'wss'],
    channelAuthorization: {
      endpoint: endpoint('/api/hibira/auth', '/lobby/auth'),
      transport: 'ajax',
      paramsProvider: () => {
        const p = loadPlayer();
        return { user_id: p.id, name: p.name };
      },
    },
  });
  return pusher;
}

export interface OpenRoom {
  id: string;
  members: number;
}

export async function listRooms(): Promise<OpenRoom[]> {
  try {
    const r = await fetch(endpoint('/api/rooms', '/lobby/rooms'));
    return r.ok ? r.json() : [];
  } catch {
    return [];
  }
}
