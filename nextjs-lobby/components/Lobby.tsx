'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import RoomView from './RoomView';
import { CAPACITY, ROOM_PREFIX, roomCode, validCode } from '@/lib/game';
import { endpoint } from '@/lib/demo';
import { randomInt } from '@/lib/random';
import { useT } from './I18n';

interface Props {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

interface OpenRoom {
  id: string;
  members: number;
}

interface Player {
  id: string;
  name: string;
}

const NAMES = ['Aiko', 'Bao', 'Chen', 'Dara', 'Emi', 'Farid', 'Ga-eun', 'Hana', 'Indra', 'Jun'];

// The player's ID and name live in this browser only. A real app has a
// signed-in user instead.
function loadPlayer(): Player {
  try {
    const saved = JSON.parse(localStorage.getItem('player') ?? 'null');
    if (saved?.id && saved?.name) return saved;
  } catch {}
  return { id: crypto.randomUUID(), name: NAMES[randomInt(NAMES.length)] };
}

export default function Lobby({ appKey, host, port, tls }: Props) {
  const t = useT();
  const [player, setPlayer] = useState<Player | null>(null);
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const pusherRef = useRef<Pusher | null>(null);

  useEffect(() => {
    const p = loadPlayer();
    setPlayer(p);
    const fromURL = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
    if (validCode(fromURL)) setRoom(fromURL);
  }, []);

  useEffect(() => {
    if (player) localStorage.setItem('player', JSON.stringify(player));
  }, [player]);

  // One connection for the whole page; the room's auth request carries the
  // player's current name.
  const pusher = useCallback((): Pusher => {
    if (!pusherRef.current) {
      pusherRef.current = new Pusher(appKey, {
        cluster: 'hkg', // required by pusher-js, unused once wsHost is set
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: tls,
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
    }
    return pusherRef.current;
  }, [appKey, host, port, tls]);

  useEffect(() => () => pusherRef.current?.disconnect(), []);

  // The room list refreshes every few seconds while it is on screen.
  useEffect(() => {
    if (room) return;
    let stop = false;
    const load = () =>
      fetch(endpoint('/api/rooms', '/lobby/rooms'))
        .then((r) => (r.ok ? r.json() : []))
        .then((list: OpenRoom[]) => !stop && setRooms(list))
        .catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [room]);

  const enter = (id: string) => {
    setNotice('');
    setRoom(id);
    history.replaceState(null, '', `?room=${id}`);
  };

  const leave = (why?: string) => {
    setRoom(null);
    setNotice(why ?? '');
    history.replaceState(null, '', location.pathname);
  };

  if (!player) return null;

  if (room) {
    return <RoomView key={room} pusher={pusher()} channel={ROOM_PREFIX + room} code={room} onLeave={leave} />;
  }

  return (
    <main className="lobby">
      <header>
        <h1>{t.title}</h1>
        <p className="muted">{t.intro(CAPACITY)}</p>
      </header>

      <section className="card">
        <label className="field">
          <span>{t.yourName}</span>
          <input
            value={player.name}
            maxLength={20}
            onChange={(e) => setPlayer({ ...player, name: e.target.value })}
          />
        </label>
        <div className="row">
          <button className="primary" onClick={() => enter(roomCode())}>
            {t.createRoom}
          </button>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (validCode(code)) enter(code);
            }}
          >
            <input
              className="code-input"
              aria-label={t.roomCode}
              placeholder="CODE"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
            <button type="submit" disabled={!validCode(code)}>
              {t.join}
            </button>
          </form>
        </div>
        {notice && <p className="notice">{notice}</p>}
      </section>

      <section className="card">
        <h2>{t.openRooms}</h2>
        {rooms.length === 0 ? (
          <p className="muted">{t.noRooms}</p>
        ) : (
          <ul className="rooms">
            {rooms.map((r) => (
              <li key={r.id}>
                <span className="code">{r.id}</span>
                <span className="muted">{t.playerCount(r.members, CAPACITY)}</span>
                <button disabled={r.members >= CAPACITY} onClick={() => enter(r.id)}>
                  {r.members >= CAPACITY ? t.full : t.join}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
