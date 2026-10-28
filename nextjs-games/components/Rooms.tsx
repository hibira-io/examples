'use client';

import { useEffect, useRef, useState } from 'react';
import type Pusher from 'pusher-js';
import GameHeader from './GameHeader';
import { useT } from './I18n';
import { connect, type Config } from '@/lib/connect';
import { endpoint } from '@/lib/demo';
import { ROOM_GAMES, roomCode, validCode, type RoomGame } from '@/lib/games';
import { loadPlayer, savePlayer, type Player } from '@/lib/player';

export interface RoomProps {
  pusher: Pusher;
  channel: string;
  code: string;
  onLeave: (why?: string) => void;
}

interface OpenRoom {
  id: string;
  members: number;
}

/**
 * The room list of a game with rooms: create a room, join one by code or
 * from the list, or open a shared ?room= link. In a room it renders the
 * game itself.
 */
export default function Rooms({
  config,
  game,
  title,
  intro,
  children,
}: {
  config: Config;
  game: RoomGame;
  title: string;
  intro: string;
  children: (props: RoomProps) => React.ReactNode;
}) {
  const t = useT();
  const { prefix, capacity } = ROOM_GAMES[game];
  const [player, setPlayer] = useState<Player | null>(null);
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [code, setCode] = useState('');
  const [room, setRoom] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const pusherRef = useRef<Pusher | null>(null);

  useEffect(() => {
    setPlayer(loadPlayer());
    const fromURL = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
    if (validCode(fromURL)) setRoom(fromURL);
    return () => pusherRef.current?.disconnect();
  }, []);

  // The room list refreshes every few seconds while it is on screen.
  useEffect(() => {
    if (room) return;
    let stop = false;
    const load = () =>
      fetch(endpoint(`/api/rooms?game=${game}`, `/${game}/rooms`))
        .then((r) => (r.ok ? r.json() : []))
        .then((list: OpenRoom[]) => !stop && setRooms(list))
        .catch(() => {});
    load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [room, game]);

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
    pusherRef.current ??= connect(config, game);
    return <div key={room}>{children({ pusher: pusherRef.current, channel: prefix + room, code: room, onLeave: leave })}</div>;
  }

  return (
    <main className="page">
      <GameHeader title={title} intro={intro} />

      <section className="card">
        <label className="field">
          <span>{t.yourName}</span>
          <input
            value={player.name}
            maxLength={20}
            onChange={(e) => {
              const next = { ...player, name: e.target.value };
              setPlayer(next);
              savePlayer(next);
            }}
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
                <span className="muted">{t.playerCount(r.members, capacity)}</span>
                <button disabled={r.members >= capacity} onClick={() => enter(r.id)}>
                  {r.members >= capacity ? t.full : t.join}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
