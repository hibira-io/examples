// Connect Four. A game is its list of moves (columns), so both players
// build the same board from the same moves; a move is one client event.

export const ROWS = 6;
export const COLS = 7;
export const MOVE_EVENT = 'client-four-move';
export const STATE_EVENT = 'client-four-state';

/** 0 empty, 1 the first player's disc, 2 the second's. board[row][col], row 0 at the top. */
export type Board = number[][];

export interface Move {
  game: number;
  n: number;
  col: number;
}

/** A game: who moved first (the red discs), and the columns played so far. */
export interface GameState {
  game: number;
  first: string;
  moves: number[];
  wins: Record<string, number>;
}

export function play(moves: number[]): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  moves.forEach((col, n) => {
    const row = dropRow(board, col);
    if (row >= 0) board[row][col] = (n % 2) + 1;
  });
  return board;
}

/** The row a disc dropped in this column lands on, or -1 when it is full. */
export function dropRow(board: Board, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let row = ROWS - 1; row >= 0; row--) if (board[row][col] === 0) return row;
  return -1;
}

/** The four (or more) winning cells, or null. */
export function winningLine(board: Board): [number, number][] | null {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || board[rr][cc] !== piece) break;
          line.push([rr, cc]);
        }
        if (line.length === 4) return line;
      }
    }
  }
  return null;
}

export function boardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}
