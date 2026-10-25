'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import RoomView from './RoomView';
import { CAPACITY, ROOM_PREFIX, roomCode, validCode } from '@/lib/game';

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
  return { id: crypto.randomUUID(), name: NAMES[Math.floor(Math.random() * NAMES.length)] };
}

export default function Lobby({ appKey, host, port, tls }: Props) {
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
        cluster: 'hibira', // required by pusher-js, unused once wsHost is set
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: tls,
        enabledTransports: ['ws', 'wss'],
        channelAuthorization: {
          endpoint: '/api/hibira/auth',
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
      fetch('/api/rooms')
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
        <h1>Reaction rooms</h1>
        <p className="muted">
          Up to {CAPACITY} players per room. Everyone gets ready, the host starts, and the fastest tap after
          “GO!” wins the round.
        </p>
      </header>

      <section className="card">
        <label className="field">
          <span>Your name</span>
          <input
            value={player.name}
            maxLength={20}
            onChange={(e) => setPlayer({ ...player, name: e.target.value })}
          />
        </label>
        <div className="row">
          <button className="primary" onClick={() => enter(roomCode())}>
            Create a room
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
              aria-label="Room code"
              placeholder="CODE"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
            <button type="submit" disabled={!validCode(code)}>
              Join
            </button>
          </form>
        </div>
        {notice && <p className="notice">{notice}</p>}
      </section>

      <section className="card">
        <h2>Open rooms</h2>
        {rooms.length === 0 ? (
          <p className="muted">No one is playing right now. Create a room and send its link to a friend.</p>
        ) : (
          <ul className="rooms">
            {rooms.map((r) => (
              <li key={r.id}>
                <span className="code">{r.id}</span>
                <span className="muted">
                  {r.members}/{CAPACITY} players
                </span>
                <button disabled={r.members >= CAPACITY} onClick={() => enter(r.id)}>
                  {r.members >= CAPACITY ? 'Full' : 'Join'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
