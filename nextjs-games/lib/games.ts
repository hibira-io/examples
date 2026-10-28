import { randomInt } from './random';

// The channels of the three games. Everything a game does travels as client
// events between the browsers on these channels; the server side only signs
// subscriptions (app/api/hibira/auth/route.ts) and lists rooms.

export type GameId = 'canvas' | 'draw' | 'four';

/** The one shared canvas. */
export const CANVAS_CHANNEL = 'presence-canvas';

/** The games with rooms: presence-<prefix>XXXX, with seats. */
export const ROOM_GAMES = {
  draw: { prefix: 'presence-draw-', capacity: 8 },
  four: { prefix: 'presence-four-', capacity: 2 },
} as const;

export type RoomGame = keyof typeof ROOM_GAMES;

export function roomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => letters[randomInt(letters.length)]).join('');
}

export function validCode(code: string): boolean {
  return /^[A-Z]{4}$/.test(code);
}
