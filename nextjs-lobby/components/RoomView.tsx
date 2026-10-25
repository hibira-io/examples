'use client';

import { useEffect, useRef, useState } from 'react';
import type Pusher from 'pusher-js';
import { Room, type ChatMessage, type Member } from '@hibira-io/lobby';
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
    room.on('full', () => onLeave(`Room ${code} is full.`));
    room.on('kicked', () => onLeave('The host removed you from the room.'));
    room.on('start', ({ data }) => play(data as GameStart));
    room.on('error', (err) => console.warn(err));
    // The auth endpoint refuses a full room before the subscription starts.
    room.channel.bind('pusher:subscription_error', (e: { status?: number }) =>
      onLeave(e?.status === 403 ? `Room ${code} is full.` : 'Could not join the room.'),
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
    let t = 0;
    game.delays.forEach((delay, round) => {
      timers.current.push(
        setTimeout(() => {
          setTaps(new Map());
          setStage({ kind: 'wait', round });
        }, t),
      );
      t += delay;
      timers.current.push(setTimeout(() => setStage({ kind: 'go', round, at: performance.now() }), t));
      t += ROUND_WINDOW;
      timers.current.push(
        setTimeout(() => {
          const winner = roundWinner(tapsRef.current);
          if (winner) setScores((s) => ({ ...s, [winner]: (s[winner] ?? 0) + 1 }));
          setStage({ kind: 'result', round, winner });
        }, t),
      );
      t += 1500;
    });
    timers.current.push(setTimeout(() => setStage({ kind: 'over' }), t));
  }

  function tap() {
    if (!room?.myID) return;
    const s = stageRef.current;
    if (s.kind !== 'wait' && s.kind !== 'go') return;
    if (tapsRef.current.has(room.myID)) return;
    const t: Tap = { round: s.round, ms: s.kind === 'go' ? Math.round(performance.now() - s.at) : -1 };
    // Client events are not echoed to the sender, so record our own tap here.
    room.channel.trigger(TAP_EVENT, t);
    record(room.myID, t);
  }

  if (!room || !room.ready) {
    return (
      <main className="lobby">
        <p className="muted">Joining room {code}…</p>
      </main>
    );
  }

  const players = room.players;
  const name = (id: string | null) => (id ? (room.players.find((p) => p.id === id)?.info?.name ?? 'Someone') : '');
  const playing = stage.kind !== 'lobby' && stage.kind !== 'over';
  const canStart = room.isHost && players.length >= 2 && room.allReady && !playing;
  const typing = room.typing.map((id) => name(id)).filter(Boolean);

  return (
    <main className="lobby room">
      <header>
        <div>
          <h1>
            Room <span className="code">{code}</span>
          </h1>
          <p className="muted">Send this page's link to a friend to play together.</p>
        </div>
        <button onClick={() => onLeave()}>Leave</button>
      </header>

      <div className="grid">
        <section className="card">
          <h2>
            Players {players.length}/{CAPACITY}
          </h2>
          <ul className="players">
            {players.map((p: Member<Info>) => (
              <li key={p.id} className={p.me ? 'me' : undefined}>
                <span>
                  {p.info?.name ?? 'Player'}
                  {p.host && <span className="badge">host</span>}
                  {p.me && <span className="badge">you</span>}
                </span>
                <span className="score">{scores[p.id] ?? 0}</span>
                <span className={p.ready ? 'ready' : 'muted'}>{p.ready ? 'Ready' : 'Not ready'}</span>
                {room.isHost && !p.me && (
                  <button className="link" onClick={() => room.kick(p.id)} title="Remove from room">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="row">
            <button onClick={() => room.setReady(!room.me?.ready)} disabled={playing}>
              {room.me?.ready ? 'Not ready' : "I'm ready"}
            </button>
            {room.isHost ? (
              <button className="primary" disabled={!canStart} onClick={() => room.start(newGame())}>
                {stage.kind === 'over' ? 'Play again' : 'Start game'}
              </button>
            ) : (
              <span className="muted">Waiting for {name(room.host?.id ?? null)} to start</span>
            )}
          </div>
          {room.isHost && !canStart && !playing && (
            <p className="muted small">The game starts when at least two players are in and everyone is ready.</p>
          )}
        </section>

        <section className="card arena">
          <button className={`pad ${stage.kind}`} onPointerDown={tap} disabled={!playing}>
            {stage.kind === 'lobby' && 'Get ready'}
            {stage.kind === 'wait' && 'Wait for it…'}
            {stage.kind === 'go' && (room.myID && taps.has(room.myID) ? `${taps.get(room.myID)} ms` : 'GO!')}
            {stage.kind === 'result' && (stage.winner ? `${name(stage.winner)} wins round ${stage.round + 1}` : 'No winner')}
            {stage.kind === 'over' && `Game over: ${name(leader(scores)) || 'nobody'} wins`}
          </button>
          {room.myID && taps.get(room.myID) === -1 && <p className="notice">Too early! Wait for “GO!”.</p>}
        </section>

        <section className="card chat">
          <h2>Chat</h2>
          <ul className="messages">
            {room.messages.map((m: ChatMessage<Info>) => (
              <li key={m.id} className={m.mine ? 'mine' : undefined}>
                <strong>{m.info?.name ?? 'Player'}</strong> {m.text}
              </li>
            ))}
          </ul>
          <p className="muted small typing">{typing.length > 0 && `${typing.join(', ')} typing…`}</p>
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
              aria-label="Message"
              placeholder="Say something"
              value={draft}
              maxLength={200}
              onChange={(e) => {
                setDraft(e.target.value);
                room.sendTyping();
              }}
            />
            <button type="submit">Send</button>
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
