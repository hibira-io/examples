// The reaction game. The host's start event carries the whole game (round
// delays), so every player runs the same rounds from the moment the event
// arrives; taps travel as client events on the room channel.

export const CAPACITY = 4;
export const ROUNDS = 5;
/** How long a round stays open after "GO!", in ms. */
export const ROUND_WINDOW = 2000;
export const TAP_EVENT = 'client-game-tap';
export const ROOM_PREFIX = 'presence-room-';

export interface GameStart {
  /** Wait before each round's "GO!", in ms. */
  delays: number[];
}

/** A player's tap in one round: ms after "GO!", or -1 for a false start. */
export interface Tap {
  round: number;
  ms: number;
}

export function newGame(): GameStart {
  return { delays: Array.from({ length: ROUNDS }, () => 1500 + Math.floor(Math.random() * 2500)) };
}

/** The winner of a round: the fastest tap that was not a false start. */
export function roundWinner(taps: Map<string, number>): string | null {
  let best: string | null = null;
  let bestMs = Infinity;
  for (const [id, ms] of taps) {
    if (ms >= 0 && ms < bestMs) {
      best = id;
      bestMs = ms;
    }
  }
  return best;
}

export function roomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
}

export function validCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}
