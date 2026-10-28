'use client';

import Draw from './Draw';
import Four from './Four';
import Rooms from './Rooms';
import { useT } from './I18n';
import type { Config } from '@/lib/connect';
import { ROOM_GAMES } from '@/lib/games';

/** Draw & guess: its room list, and the game in a room. */
export function DrawGame({ config }: { config: Config }) {
  const t = useT();
  return (
    <Rooms config={config} game="draw" title={t.drawTitle} intro={t.drawIntro(ROOM_GAMES.draw.capacity)}>
      {(room) => <Draw {...room} />}
    </Rooms>
  );
}

/** Connect Four: its room list, and the game in a room. */
export function FourGame({ config }: { config: Config }) {
  const t = useT();
  return (
    <Rooms config={config} game="four" title={t.fourTitle} intro={t.fourIntro}>
      {(room) => <Four {...room} />}
    </Rooms>
  );
}
