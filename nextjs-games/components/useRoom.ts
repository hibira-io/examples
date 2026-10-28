'use client';

import { useEffect, useRef, useState } from 'react';
import { Room } from '@hibira-io/lobby';
import { useT } from './I18n';
import type { RoomProps } from './Rooms';

export interface Info {
  name: string;
}

/**
 * Joins the room with @hibira-io/lobby (seats, host and chat), re-renders on
 * its changes, and leaves when the component goes. `bind` adds the game's
 * own client events to the channel.
 */
export function useRoom(
  { pusher, channel, code, onLeave }: RoomProps,
  capacity: number,
  bind: (room: Room<Info>) => void,
): Room<Info> | null {
  const t = useT();
  const roomRef = useRef<Room<Info> | null>(null);
  const [, render] = useState(0);

  useEffect(() => {
    const room = Room.join<Info>(pusher, channel, { capacity });
    roomRef.current = room;
    const update = () => render((n) => n + 1);
    for (const ev of ['ready', 'members', 'host', 'message', 'typing'] as const) room.on(ev, update);
    room.on('full', () => onLeave(t.roomFull(code)));
    room.on('error', (err) => console.warn(err));
    // The auth endpoint refuses a full room before the subscription starts.
    room.channel.bind('pusher:subscription_error', (e: { status?: number }) =>
      onLeave(e?.status === 403 ? t.roomFull(code) : t.joinFailed),
    );
    bind(room);
    return () => {
      room.channel.unbind_all();
      room.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pusher, channel]);

  return roomRef.current?.ready ? roomRef.current : null;
}
