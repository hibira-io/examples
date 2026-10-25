import { NextResponse } from 'next/server';
import { authorizeRoom, RoomFullError } from '@hibira-io/lobby/server';
import { configured, hibira } from '@/lib/hibira';
import { CAPACITY, ROOM_PREFIX, validCode } from '@/lib/game';

export const runtime = 'nodejs';

// Authorizes a room subscription. authorizeRoom signs joined_at into the
// player's info, which decides seats and the host, and refuses a full room.
// This demo trusts the name and ID the browser sends; a real app takes them
// from its own session.
export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const form = await request.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  const userId = String(form.get('user_id') ?? '').slice(0, 64);
  const name = String(form.get('name') ?? '').trim().slice(0, 20) || 'Player';
  if (!channel.startsWith(ROOM_PREFIX) || !validCode(channel.slice(ROOM_PREFIX.length)) || !userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const auth = await authorizeRoom(hibira(), { socketId, channel, userId, userInfo: { name }, capacity: CAPACITY });
    return NextResponse.json(auth);
  } catch (err) {
    if (err instanceof RoomFullError) return NextResponse.json({ error: 'room full' }, { status: 403 });
    throw err;
  }
}
