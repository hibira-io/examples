// The shared pixel canvas: 32 × 32 pixels in 16 colors. A pixel is one
// client event; the board itself lives only in the browsers on the channel.
// A newcomer gets it from the member with the lowest ID, so when everyone
// has left it starts over from the welcome picture.

export const SIZE = 32;
export const PAINT_EVENT = 'client-canvas-paint';
export const BOARD_EVENT = 'client-canvas-board';

/** Pixels a painter can place in a row before waiting; one comes back each REFILL_MS. */
export const INK = 5;
export const REFILL_MS = 1000;

export const PALETTE = [
  '#ffffff', '#e4e4e4', '#888888', '#222222',
  '#ffa7d1', '#e50000', '#e59500', '#a06a42',
  '#e5d900', '#94e044', '#02be01', '#00d3dd',
  '#0083c7', '#0000ea', '#cf6ee4', '#820080',
];

/** One painted pixel: its index (y * SIZE + x) and color. */
export interface Paint {
  i: number;
  c: number;
}

/** The board as one hex digit per pixel (1,024 characters), as it travels. */
export function encode(board: Uint8Array): string {
  return Array.from(board, (c) => c.toString(16)).join('');
}

export function decode(text: string): Uint8Array | null {
  if (text.length !== SIZE * SIZE || !/^[0-9a-f]+$/.test(text)) return null;
  return Uint8Array.from(text, (ch) => parseInt(ch, 16));
}

export function validPaint(p: Paint): boolean {
  return Number.isInteger(p?.i) && p.i >= 0 && p.i < SIZE * SIZE && Number.isInteger(p.c) && p.c >= 0 && p.c < PALETTE.length;
}

// A small heart on white, so an empty canvas invites a first pixel.
const HEART = ['01100110', '11111111', '11111111', '11111111', '01111110', '00111100', '00011000'];

export function welcomeBoard(): Uint8Array {
  const board = new Uint8Array(SIZE * SIZE);
  HEART.forEach((row, y) =>
    [...row].forEach((bit, x) => {
      if (bit === '1') board[(y + 12) * SIZE + x + 12] = 5;
    }),
  );
  return board;
}
