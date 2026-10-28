'use client';

import { useRef, useState } from 'react';
import type { Room } from '@hibira-io/lobby';
import Chat from './Chat';
import GameHeader from './GameHeader';
import { useT } from './I18n';
import type { RoomProps } from './Rooms';
import { useRoom, type Info } from './useRoom';
import { ROOM_GAMES } from '@/lib/games';
import {
  boardFull, COLS, dropRow, MOVE_EVENT, play, ROWS, STATE_EVENT, winningLine, type GameState, type Move,
} from '@/lib/four';

const CAPACITY = ROOM_GAMES.four.capacity;

// Both players hold the same game state: who moved first and the moves so
// far. A move is checked the same way on both sides (right game, right
// turn, right player, a column with room), so both boards stay the same.
// Whoever was in the room sends the state to a player who (re)joins.
export default function Four(props: RoomProps) {
  const t = useT();
  const [state, setState] = useState<GameState | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const opponent = useRef<string | null>(null);
  const roomRef = useRef<Room<Info> | null>(null);

  const room = useRoom(props, CAPACITY, (room) => {
    roomRef.current = room;
    // Alone in the room: a new game, with us first. Joining someone: they
    // send theirs, or, if both joined at once, the first seat starts one.
    room.on('ready', () => {
      if (room.players.length === 1) update({ game: 0, first: room.myID!, moves: [], wins: {} });
      else
        setTimeout(() => {
          if (!stateRef.current && room.players[0]?.me) send({ game: 0, first: room.myID!, moves: [], wins: {} });
        }, 2000);
    });
    room.on('members', (e) => {
      const joined = e.joined;
      const s = stateRef.current;
      if (!joined || joined.me || !s) return;
      // The same opponent back (a reload) carries on; someone new starts a new game.
      const next = joined.id === opponent.current ? s : { game: s.game + 1, first: room.myID!, moves: [], wins: {} };
      opponent.current = joined.id;
      send(next);
    });
    room.channel.bind(STATE_EVENT, (s: GameState, meta?: { user_id?: string }) => {
      if (!s || !Array.isArray(s.moves) || typeof s.first !== 'string') return;
      const cur = stateRef.current;
      if (cur && (s.game < cur.game || (s.game === cur.game && s.moves.length < cur.moves.length))) return;
      if (meta?.user_id) opponent.current = meta.user_id;
      update(s);
    });
    room.channel.bind(MOVE_EVENT, (m: Move, meta?: { user_id?: string }) => {
      if (meta?.user_id) apply(room, m, meta.user_id);
    });
  });

  function update(s: GameState) {
    stateRef.current = s;
    setState(s);
  }

  function send(s: GameState) {
    update(s);
    roomRef.current?.channel.trigger(STATE_EVENT, s);
  }

  function moverOf(s: GameState, players: string[]): string | null {
    const other = players.find((id) => id !== s.first) ?? null;
    return s.moves.length % 2 === 0 ? s.first : other;
  }

  function apply(room: Room<Info>, m: Move, by: string): boolean {
    const s = stateRef.current;
    if (!s || m.game !== s.game || m.n !== s.moves.length) return false;
    const board = play(s.moves);
    if (winningLine(board) || dropRow(board, m.col) < 0) return false;
    if (moverOf(s, room.players.map((p) => p.id)) !== by) return false;
    const moves = [...s.moves, m.col];
    const after = play(moves);
    const wins = winningLine(after) ? { ...s.wins, [by]: (s.wins[by] ?? 0) + 1 } : s.wins;
    update({ ...s, moves, wins });
    return true;
  }

  if (!room || !state) {
    return (
      <main className="page">
        <p className="muted">{t.joining(props.code)}</p>
      </main>
    );
  }

  const me = room.myID!;
  const players = room.players;
  const name = (id: string | null) => players.find((p) => p.id === id)?.info?.name ?? t.someone;
  const board = play(state.moves);
  const line = winningLine(board);
  const winner = line ? (board[line[0][0]][line[0][1]] === 1 ? state.first : players.find((p) => p.id !== state.first)?.id ?? null) : null;
  const over = Boolean(line) || boardFull(board);
  const mover = moverOf(state, players.map((p) => p.id));
  const ready = players.length === 2;
  const myTurn = ready && !over && mover === me;
  const pieceOf = (id: string) => (id === state.first ? 1 : 2);

  const drop = (col: number) => {
    if (!myTurn) return;
    const m: Move = { game: state.game, n: state.moves.length, col };
    // Client events are not echoed to the sender, so apply our own move here.
    if (apply(room, m, me)) room.channel.trigger(MOVE_EVENT, m);
  };

  const rematch = () => {
    const other = players.find((p) => p.id !== state.first)?.id ?? me;
    send({ game: state.game + 1, first: other, moves: [], wins: state.wins });
  };

  let status: string;
  if (!ready) status = t.waitingOpponent;
  else if (winner) status = winner === me ? t.youWin : t.theyWin(name(winner));
  else if (over) status = t.tie;
  else status = myTurn ? t.yourTurn : t.theirTurn(name(mover));

  const won = new Set((line ?? []).map(([r, c]) => r * COLS + c));

  return (
    <main className="page">
      <GameHeader title={t.fourTitle} intro={t.shareHint}>
        <div className="row">
          <span>
            {t.room} <span className="code">{props.code}</span>
          </span>
          <button onClick={() => props.onLeave()}>{t.leave}</button>
        </div>
      </GameHeader>

      <div className="grid">
        <section className="card four-card">
          <p className={`status${myTurn || winner === me ? ' strong' : ''}`} role="status">
            {status}
          </p>
          <div className={`four${myTurn ? ' my-turn' : ''}`}>
            {Array.from({ length: COLS }, (_, c) => (
              <button
                key={c}
                className="four-col"
                aria-label={t.dropIn(c + 1)}
                disabled={!myTurn || dropRow(board, c) < 0}
                onClick={() => drop(c)}
              >
                {Array.from({ length: ROWS }, (_, r) => (
                  <span key={r} className={`hole p${board[r][c]}${won.has(r * COLS + c) ? ' won' : ''}`} />
                ))}
              </button>
            ))}
          </div>
          {over && ready && (
            <button className="primary" onClick={rematch}>
              {t.rematch}
            </button>
          )}
        </section>

        <section className="card">
          <h2>{t.players(players.length, CAPACITY)}</h2>
          <ul className="players">
            {players.map((p) => (
              <li key={p.id} className={p.me ? 'me' : undefined}>
                <span>
                  <span className={`hole small p${pieceOf(p.id)}`} aria-hidden />
                  {p.info?.name ?? t.player}
                  {p.me && <span className="badge">{t.you}</span>}
                </span>
                <span className="score">{state.wins[p.id] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>

        <Chat room={room} />
      </div>
    </main>
  );
}
