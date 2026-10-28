import { randomInt } from './random';

// The player's ID and name live in this browser only, shared by the three
// games. A real app has a signed-in user instead.

export interface Player {
  id: string;
  name: string;
}

const NAMES = ['Aiko', 'Bao', 'Chen', 'Dara', 'Emi', 'Farid', 'Ga-eun', 'Hana', 'Indra', 'Jun'];

export function loadPlayer(): Player {
  try {
    const saved = JSON.parse(localStorage.getItem('player') ?? 'null');
    if (saved?.id && saved?.name) return saved;
  } catch {}
  const player = { id: crypto.randomUUID(), name: NAMES[randomInt(NAMES.length)] };
  savePlayer(player);
  return player;
}

export function savePlayer(player: Player) {
  try {
    localStorage.setItem('player', JSON.stringify(player));
  } catch {}
}
