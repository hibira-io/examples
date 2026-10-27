'use client';

import { useEffect, useRef, useState } from 'react';
import type Pusher from 'pusher-js';
import { Room, type ChatMessage, type Member } from '@hibira-io/lobby';
import { useT } from './I18n';
import { CAPACITY, newGame, ROUND_WINDOW, roundWinner, TAP_EVENT, type GameStart, type Tap } from '@/lib/game';

interface Props {
  pusher: Pusher;
  channel: string;
  code: string;
  onLeave: (why?: string) => void;
}

interface Info {
  name: string;
}

type Stage =
  | { kind: 'lobby' }
  | { kind: 'wait'; round: number }
  | { kind: 'go'; round: number; at: number }
  | { kind: 'result'; round: number; winner: string | null }
  | { kind: 'over' };

export default function RoomView({ pusher, channel, code, onLeave }: Props) {
  const t = useT();
  const roomRef = useRef<Room<Info> | null>(null);
  const [, render] = useState(0);
  const [stage, setStage] = useState<Stage>({ kind: 'lobby' });
  const [scores, setScores] = useState<Record<string, number>>({});
  const [taps, setTaps] = useState<Map<string, number>>(new Map());
  const [draft, setDraft] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const tapsRef = useRef(taps);
  tapsRef.current = taps;

  useEffect(() => {
    const room = Room.join<Info>(pusher, channel, { capacity: CAPACITY });
    roomRef.current = room;
    const update = () => render((n) => n + 1);
    for (const ev of ['ready', 'members', 'host', 'settings', 'message', 'typing'] as const) room.on(ev, update);
    room.on('full', () => onLeave(t.roomFull(code)));
    room.on('kicked', () => onLeave(t.kicked));
    room.on('start', ({ data }) => play(data as GameStart));
    room.on('error', (err) => console.warn(err));
    // The auth endpoint refuses a full room before the subscription starts.
    room.channel.bind('pusher:subscription_error', (e: { status?: number }) =>
      onLeave(e?.status === 403 ? t.roomFull(code) : t.joinFailed),
    );
    room.channel.bind(TAP_EVENT, (tap: Tap, meta?: { user_id?: string }) => {
      if (meta?.user_id) record(meta.user_id, tap);
    });
    return () => {
      clearTimers();
      room.channel.unbind(TAP_EVENT);
      room.channel.unbind('pusher:subscription_error');
      room.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pusher, channel]);

  const room = roomRef.current;

  function clearTimers() {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }

  function record(userId: string, tap: Tap) {
    const s = stageRef.current;
    if ((s.kind !== 'go' && s.kind !== 'wait') || s.round !== tap.round) return;
    setTaps((prev) => (prev.has(userId) ? prev : new Map(prev).set(userId, tap.ms)));
  }

  // Every player runs the same rounds from the start event: wait, "GO!",
  // a window for taps, then the fastest valid tap scores.
  function play(game: GameStart) {
    clearTimers();
    setScores({});
    let at = 0;
    game.delays.forEach((delay, round) => {
      timers.current.push(
        setTimeout(() => {
          setTaps(new Map());
          setStage({ kind: 'wait', round });
        }, at),
      );
      at += delay;
      timers.current.push(setTimeout(() => setStage({ kind: 'go', round, at: performance.now() }), at));
      at += ROUND_WINDOW;
      timers.current.push(
        setTimeout(() => {
          const winner = roundWinner(tapsRef.current);
          if (winner) setScores((s) => ({ ...s, [winner]: (s[winner] ?? 0) + 1 }));
          setStage({ kind: 'result', round, winner });
        }, at),
      );
      at += 1500;
    });
    timers.current.push(setTimeout(() => setStage({ kind: 'over' }), at));
  }

  function tap() {
    if (!room?.myID) return;
    const s = stageRef.current;
    if (s.kind !== 'wait' && s.kind !== 'go') return;
    if (tapsRef.current.has(room.myID)) return;
    const mine: Tap = { round: s.round, ms: s.kind === 'go' ? Math.round(performance.now() - s.at) : -1 };
    // Client events are not echoed to the sender, so record our own tap here.
    room.channel.trigger(TAP_EVENT, mine);
    record(room.myID, mine);
  }

  if (!room || !room.ready) {
    return (
      <main className="lobby">
        <p className="muted">{t.joining(code)}</p>
      </main>
    );
  }

  const players = room.players;
  const name = (id: string | null) => (id ? (room.players.find((p) => p.id === id)?.info?.name ?? t.someone) : '');
  const playing = stage.kind !== 'lobby' && stage.kind !== 'over';
  const canStart = room.isHost && players.length >= 2 && room.allReady && !playing;
  const typing = room.typing.map((id) => name(id)).filter(Boolean);

  return (
    <main className="lobby room">
      <header>
        <div>
          <h1>
            {t.room} <span className="code">{code}</span>
          </h1>
          <p className="muted">{t.shareHint}</p>
        </div>
        <button onClick={() => onLeave()}>{t.leave}</button>
      </header>

      <div className="grid">
        <section className="card">
          <h2>{t.players(players.length, CAPACITY)}</h2>
          <ul className="players">
            {players.map((p: Member<Info>) => (
              <li key={p.id} className={p.me ? 'me' : undefined}>
                <span>
                  {p.info?.name ?? t.player}
                  {p.host && <span className="badge">{t.host}</span>}
                  {p.me && <span className="badge">{t.you}</span>}
                </span>
                <span className="score">{scores[p.id] ?? 0}</span>
                <span className={p.ready ? 'ready' : 'muted'}>{p.ready ? t.ready : t.notReady}</span>
                {room.isHost && !p.me && (
                  <button className="link" onClick={() => room.kick(p.id)} title={t.removeTitle}>
                    {t.remove}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="row">
            <button onClick={() => room.setReady(!room.me?.ready)} disabled={playing}>
              {room.me?.ready ? t.notReady : t.imReady}
            </button>
            {room.isHost ? (
              <button className="primary" disabled={!canStart} onClick={() => room.start(newGame())}>
                {stage.kind === 'over' ? t.playAgain : t.startGame}
              </button>
            ) : (
              <span className="muted">{t.waitingFor(name(room.host?.id ?? null))}</span>
            )}
          </div>
          {room.isHost && !canStart && !playing && (
            <p className="muted small">{t.startHint}</p>
          )}
        </section>

        <section className="card arena">
          <button className={`pad ${stage.kind}`} onPointerDown={tap} disabled={!playing}>
            {stage.kind === 'lobby' && t.getReady}
            {stage.kind === 'wait' && t.waitForIt}
            {stage.kind === 'go' && (room.myID && taps.has(room.myID) ? `${taps.get(room.myID)} ms` : 'GO!')}
            {stage.kind === 'result' && (stage.winner ? t.roundWinner(name(stage.winner), stage.round + 1) : t.noWinner)}
            {stage.kind === 'over' && t.gameOver(name(leader(scores)) || t.nobody)}
          </button>
          {room.myID && taps.get(room.myID) === -1 && <p className="notice">{t.tooEarly}</p>}
        </section>

        <section className="card chat">
          <h2>{t.chat}</h2>
          <ul className="messages">
            {room.messages.map((m: ChatMessage<Info>) => (
              <li key={m.id} className={m.mine ? 'mine' : undefined}>
                <strong>{m.info?.name ?? t.player}</strong> {m.text}
              </li>
            ))}
          </ul>
          <p className="muted small typing">{typing.length > 0 && t.typing(typing.join(', '))}</p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              room.send(draft.trim());
              setDraft('');
            }}
          >
            <input
              aria-label={t.message}
              placeholder={t.saySomething}
              value={draft}
              maxLength={200}
              onChange={(e) => {
                setDraft(e.target.value);
                room.sendTyping();
              }}
            />
            <button type="submit">{t.send}</button>
          </form>
        </section>
      </div>
    </main>
  );
}

function leader(scores: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [id, n] of Object.entries(scores)) if (best === null || n > scores[best]) best = id;
  return best;
}
