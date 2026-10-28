'use client';

import { useEffect, useRef, useState } from 'react';
import type { Room } from '@hibira-io/lobby';
import Chat from './Chat';
import GameHeader from './GameHeader';
import { useLang, useT } from './I18n';
import type { RoomProps } from './Rooms';
import { useRoom, type Info } from './useRoom';
import { ROOM_GAMES } from '@/lib/games';
import {
  answerHashes, BATCH_MS, CLEAR_EVENT, COLORS, CORRECT_EVENT, DRAWER_POINTS, guessPoints, isAnswer, nextDrawer,
  REVEAL_EVENT, REVEAL_MS, ROUND_MS, SCALE, STATE_EVENT, STROKES_EVENT, WIDTHS, WORD_EVENT, WORDS, wordIn,
  type DrawState, type StrokePart,
} from '@/lib/draw';

const CAPACITY = ROOM_GAMES.draw.capacity;
const W = 800;
const H = 600;

type Meta = { user_id?: string } | undefined;

interface Line {
  id: string;
  text: string;
  at: number;
}

// Everything the game knows, kept in one ref because the channel's handlers
// are bound once; `render` shows the changes.
interface Game {
  state: DrawState;
  endsAt: number;
  /** The drawer's word this round (only on the drawer's side). */
  word: number | null;
  /** The hashes of this round's answers, from the drawer. */
  hashes: string[] | null;
  hashRound: number;
  revealed: { round: number; word: number } | null;
  strokes: StrokePart[];
  lines: Line[];
}

const WAITING: DrawState = { round: 0, phase: 'waiting', drawer: null, left: 0, scores: {}, guessed: [] };

export default function Draw(props: RoomProps) {
  const t = useT();
  const lang = useLang();
  const [, setTick] = useState(0);
  const render = () => setTick((n) => n + 1);
  const g = useRef<Game>({ state: WAITING, endsAt: 0, word: null, hashes: null, hashRound: 0, revealed: null, strokes: [], lines: [] });
  const roomRef = useRef<Room<Info> | null>(null);
  const hostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pen = useRef({ color: 0, width: 1, stroke: null as StrokePart | null, pending: new Map<string, StrokePart>() });
  const tRef = useRef(t);
  tRef.current = t;

  const salt = (round: number) => `${props.code}:${round}`;
  const me = () => roomRef.current?.myID ?? '';
  const nameOf = (id: string | null) => roomRef.current?.players.find((p) => p.id === id)?.info?.name ?? tRef.current.someone;
  const say = (text: string) => {
    g.current.lines = [...g.current.lines.slice(-30), { id: crypto.randomUUID(), text, at: Date.now() }];
  };

  const room = useRoom(props, CAPACITY, (room) => {
    roomRef.current = room;
    room.channel.bind(STATE_EVENT, (s: DrawState) => receiveState(s));
    room.channel.bind(WORD_EVENT, (d: { round: number; hashes: string[] }) => {
      if (d?.round !== g.current.state.round || !Array.isArray(d.hashes)) return;
      g.current.hashes = d.hashes;
      g.current.hashRound = d.round;
      render();
    });
    room.channel.bind(STROKES_EVENT, (d: { round: number; s: StrokePart[] }) => {
      if (d?.round !== g.current.state.round || !Array.isArray(d.s)) return;
      for (const part of d.s) addPart(part);
    });
    room.channel.bind(CLEAR_EVENT, (d: { round: number }) => {
      if (d?.round === g.current.state.round) clearBoard();
    });
    room.channel.bind(CORRECT_EVENT, (d: { round: number }, meta: Meta) => {
      if (!meta?.user_id || d?.round !== g.current.state.round) return;
      say(tRef.current.guessedIt(nameOf(meta.user_id)));
      render();
      if (room.isHost) correct(meta.user_id, d.round);
    });
    room.channel.bind(REVEAL_EVENT, (d: { round: number; word: number }) => {
      if (d?.round === g.current.state.round && WORDS[d.word]) showReveal(d.round, d.word);
    });
    room.on('members', (e) => {
      const s = g.current.state;
      if (e.joined && !e.joined.me) {
        // A newcomer gets the round from the host, and this round's hashes from the drawer.
        if (room.isHost) broadcast(s);
        if (s.drawer === me() && g.current.hashes && s.phase === 'drawing') {
          room.channel.trigger(WORD_EVENT, { round: s.round, hashes: g.current.hashes });
        }
      }
      if (e.left && room.isHost && s.phase !== 'waiting') {
        if (room.players.length < 2) broadcast({ ...s, phase: 'waiting', drawer: null });
        else if (e.left.id === s.drawer && s.phase === 'drawing') broadcast({ ...s, phase: 'reveal', left: REVEAL_MS });
      }
    });
    // A new host carries on from the last state it saw.
    room.on('host', ({ host }) => {
      if (host.me && g.current.state.phase !== 'waiting') scheduleHost();
    });
  });

  // The countdown on screen, and the drawer's batches of points.
  useEffect(() => {
    const clock = setInterval(render, 500);
    const batches = setInterval(flush, BATCH_MS);
    return () => {
      clearInterval(clock);
      clearInterval(batches);
      if (hostTimer.current) clearTimeout(hostTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- The host's side: rounds, timer and scores. ---

  function broadcast(s: DrawState) {
    const next = { ...s, left: s.phase === 'waiting' ? 0 : Math.max(0, s.left) };
    roomRef.current?.channel.trigger(STATE_EVENT, next);
    // Client events are not echoed to the sender, so take our own state here.
    receiveState(next);
  }

  function scheduleHost() {
    if (hostTimer.current) clearTimeout(hostTimer.current);
    const s = g.current.state;
    if (s.phase === 'waiting') return;
    hostTimer.current = setTimeout(() => {
      const room = roomRef.current;
      const cur = g.current.state;
      if (!room?.isHost || cur.round !== s.round || cur.phase !== s.phase) return;
      if (cur.phase === 'drawing') broadcast({ ...cur, phase: 'reveal', left: REVEAL_MS });
      else nextRound(cur);
    }, Math.max(0, g.current.endsAt - Date.now()));
  }

  function nextRound(cur: DrawState) {
    const players = roomRef.current?.players.map((p) => p.id) ?? [];
    if (players.length < 2) {
      broadcast({ ...cur, phase: 'waiting', drawer: null });
      return;
    }
    broadcast({ ...cur, round: cur.round + 1, phase: 'drawing', drawer: nextDrawer(players, cur.drawer), left: ROUND_MS, guessed: [] });
  }

  function correct(by: string, round: number) {
    const s = g.current.state;
    if (s.phase !== 'drawing' || s.round !== round || by === s.drawer || s.guessed.includes(by)) return;
    const scores = { ...s.scores, [by]: (s.scores[by] ?? 0) + guessPoints(s.guessed.length) };
    if (s.drawer) scores[s.drawer] = (scores[s.drawer] ?? 0) + DRAWER_POINTS;
    const guessed = [...s.guessed, by];
    const guessers = roomRef.current?.players.filter((p) => p.id !== s.drawer).length ?? 0;
    const left = Math.max(0, g.current.endsAt - Date.now());
    broadcast(guessed.length >= guessers ? { ...s, scores, guessed, phase: 'reveal', left: REVEAL_MS } : { ...s, scores, guessed, left });
  }

  // --- Everyone's side. ---

  async function receiveState(s: DrawState) {
    if (!s || typeof s.round !== 'number' || !s.scores || !Array.isArray(s.guessed)) return;
    const prev = g.current.state;
    g.current.state = s;
    g.current.endsAt = Date.now() + (s.left ?? 0);
    if (s.round !== prev.round) {
      g.current.word = null;
      g.current.hashes = null;
      clearBoard();
    }
    if (roomRef.current?.isHost) scheduleHost();
    render();
    const mine = s.drawer === me();
    if (mine && s.phase === 'drawing' && g.current.word === null) {
      const word = Math.floor(Math.random() * WORDS.length);
      g.current.word = word;
      const hashes = await answerHashes(word, salt(s.round));
      if (g.current.state.round !== s.round) return;
      g.current.hashes = hashes;
      g.current.hashRound = s.round;
      roomRef.current?.channel.trigger(WORD_EVENT, { round: s.round, hashes });
    }
    if (mine && s.phase === 'reveal' && g.current.word !== null && g.current.revealed?.round !== s.round) {
      roomRef.current?.channel.trigger(REVEAL_EVENT, { round: s.round, word: g.current.word });
      showReveal(s.round, g.current.word);
    }
  }

  function showReveal(round: number, word: number) {
    if (g.current.revealed?.round === round) return;
    g.current.revealed = { round, word };
    say(tRef.current.wordWas(wordIn(word, lang)));
    render();
  }

  async function submit(text: string) {
    const room = roomRef.current;
    if (!room) return;
    const s = g.current.state;
    const guessing = s.phase === 'drawing' && g.current.hashes && g.current.hashRound === s.round;
    if (guessing && (await isAnswer(text, salt(s.round), g.current.hashes!))) {
      // The answer itself never goes to the chat, from guessers or the drawer.
      if (s.drawer === me() || s.guessed.includes(me())) return;
      room.channel.trigger(CORRECT_EVENT, { round: s.round });
      say(tRef.current.youGotIt);
      render();
      if (room.isHost) correct(me(), s.round);
      return;
    }
    room.send(text);
  }

  // --- The drawing. ---

  function ctx() {
    return canvasRef.current?.getContext('2d') ?? null;
  }

  function clearBoard() {
    g.current.strokes = [];
    pen.current.stroke = null;
    pen.current.pending.clear();
    const c = ctx();
    if (c) {
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, W, H);
    }
  }

  function addPart(part: StrokePart) {
    if (typeof part?.id !== 'string' || !Array.isArray(part.p) || !COLORS[part.c] || !WIDTHS[part.w]) return;
    let stroke = g.current.strokes.find((s) => s.id === part.id);
    const from = stroke ? stroke.p.slice(-2) : [];
    if (!stroke) {
      stroke = { id: part.id, c: part.c, w: part.w, p: [] };
      g.current.strokes.push(stroke);
    }
    stroke.p.push(...part.p);
    drawPoints(stroke, [...from, ...part.p]);
  }

  function drawPoints(stroke: StrokePart, p: number[]) {
    const c = ctx();
    if (!c || p.length < 2) return;
    c.strokeStyle = COLORS[stroke.c];
    c.fillStyle = COLORS[stroke.c];
    c.lineWidth = WIDTHS[stroke.w];
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const x = (v: number) => (v / SCALE) * W;
    const y = (v: number) => (v / SCALE) * H;
    if (p.length === 2) {
      c.beginPath();
      c.arc(x(p[0]), y(p[1]), WIDTHS[stroke.w] / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    c.moveTo(x(p[0]), y(p[1]));
    for (let i = 2; i < p.length; i += 2) c.lineTo(x(p[i]), y(p[i + 1]));
    c.stroke();
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.max(0, Math.min(SCALE, Math.round(v * SCALE)));
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
  }

  function penDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const stroke: StrokePart = { id: crypto.randomUUID().slice(0, 8), c: pen.current.color, w: pen.current.width, p: [] };
    pen.current.stroke = stroke;
    g.current.strokes.push(stroke);
    penAdd(point(e));
  }

  function penAdd([x, y]: [number, number]) {
    const stroke = pen.current.stroke;
    if (!stroke) return;
    const from = stroke.p.slice(-2);
    if (from.length && Math.abs(from[0] - x) + Math.abs(from[1] - y) < 4) return;
    stroke.p.push(x, y);
    drawPoints(stroke, [...from, x, y]);
    const part = pen.current.pending.get(stroke.id) ?? { id: stroke.id, c: stroke.c, w: stroke.w, p: [] };
    part.p.push(x, y);
    pen.current.pending.set(stroke.id, part);
  }

  // Sends the points drawn since the last batch: one client event, well
  // under the 10 a second a connection may send.
  function flush() {
    const { pending } = pen.current;
    const room = roomRef.current;
    if (pending.size === 0 || !room) return;
    const s = [...pending.values()];
    pending.clear();
    room.channel.trigger(STROKES_EVENT, { round: g.current.state.round, s });
  }

  const state = g.current.state;
  const meId = room?.myID ?? '';
  const drawer = state.drawer;
  const canDraw = state.phase === 'drawing' && drawer === meId;

  if (!room) {
    return (
      <main className="page">
        <p className="muted">{t.joining(props.code)}</p>
      </main>
    );
  }

  const players = [...room.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0));
  const seconds = Math.max(0, Math.ceil((g.current.endsAt - Date.now()) / 1000));
  let status: React.ReactNode;
  if (state.phase === 'waiting') {
    status = room.players.length < 2 ? t.needTwo : room.isHost ? null : t.waitingHost(nameOf(room.host?.id ?? null));
  } else if (state.phase === 'reveal') {
    status = g.current.revealed?.round === state.round ? t.wordWas(wordIn(g.current.revealed.word, lang)) : t.roundN(state.round);
  } else if (canDraw && g.current.word !== null) {
    status = (
      <>
        {t.yourWord} <strong className="word">{wordIn(g.current.word, lang)}</strong>
      </>
    );
  } else if (state.guessed.includes(meId)) {
    status = t.youGotIt;
  } else {
    status = t.drawing(nameOf(drawer));
  }

  return (
    <main className="page">
      <GameHeader title={t.drawTitle} intro={t.shareHint}>
        <div className="row">
          <span>
            {t.room} <span className="code">{props.code}</span>
          </span>
          <button onClick={() => props.onLeave()}>{t.leave}</button>
        </div>
      </GameHeader>

      <div className="grid">
        <section className="card board-card">
          <div className="board-bar">
            <span className="status" role="status">
              {status}
            </span>
            {state.phase !== 'waiting' && (
              <span className="muted">
                {t.roundN(state.round)} · {t.secondsLeft(seconds)}
              </span>
            )}
            {state.phase === 'waiting' && room.isHost && (
              <button className="primary" disabled={room.players.length < 2} onClick={() => nextRound(state)}>
                {t.start}
              </button>
            )}
          </div>
          <canvas
            ref={canvasRef}
            className={`board${canDraw ? ' drawing' : ''}`}
            width={W}
            height={H}
            onPointerDown={penDown}
            onPointerMove={(e) => e.buttons === 1 && penAdd(point(e))}
            onPointerUp={() => (pen.current.stroke = null)}
          />
          {canDraw && (
            <div className="tools">
              {COLORS.map((c, n) => (
                <button
                  key={c}
                  aria-label={t.color(n + 1)}
                  title={t.color(n + 1)}
                  className={n === pen.current.color ? 'swatch on' : 'swatch'}
                  style={{ background: c }}
                  onClick={() => {
                    pen.current.color = n;
                    render();
                  }}
                />
              ))}
              {WIDTHS.map((w, n) => (
                <button
                  key={w}
                  aria-label={`${w}px`}
                  title={`${w}px`}
                  className={n === pen.current.width ? 'width on' : 'width'}
                  onClick={() => {
                    pen.current.width = n;
                    render();
                  }}
                >
                  <span style={{ width: w, height: w }} />
                </button>
              ))}
              <button
                onClick={() => {
                  clearBoard();
                  room.channel.trigger(CLEAR_EVENT, { round: state.round });
                }}
              >
                {t.clear}
              </button>
            </div>
          )}
        </section>

        <section className="card">
          <h2>{t.players(room.players.length, CAPACITY)}</h2>
          <ul className="players">
            {players.map((p) => (
              <li key={p.id} className={p.me ? 'me' : undefined}>
                <span>
                  {p.id === drawer && state.phase !== 'waiting' && <span aria-hidden>✏️</span>}
                  {state.guessed.includes(p.id) && <span className="ready">✓</span>}
                  {p.info?.name ?? t.player}
                  {p.host && <span className="badge">{t.host}</span>}
                  {p.me && <span className="badge">{t.you}</span>}
                </span>
                <span className="score">{state.scores[p.id] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>

        <Chat room={room} placeholder={state.phase === 'drawing' && !canDraw ? t.guessHere : undefined} onSubmit={submit} system={g.current.lines} />
      </div>
    </main>
  );
}
