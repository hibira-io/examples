import { NextResponse } from 'next/server';
import { authorizeRoom, RoomFullError } from '@hibira-io/lobby/server';
import { configured, hibira } from '@/lib/hibira';
import { CANVAS_CHANNEL, ROOM_GAMES, validCode } from '@/lib/games';

export const runtime = 'nodejs';

// Authorizes the games' presence channels: the shared canvas, and the rooms
// of draw & guess and Connect Four. authorizeRoom signs joined_at into the
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
  if (!userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (channel === CANVAS_CHANNEL) {
    return NextResponse.json(hibira().authorizeChannel(socketId, channel, { user_id: userId, user_info: { name } }));
  }
  const game = Object.values(ROOM_GAMES).find((g) => channel.startsWith(g.prefix));
  if (!game || !validCode(channel.slice(game.prefix.length))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const auth = await authorizeRoom(hibira(), { socketId, channel, userId, userInfo: { name }, capacity: game.capacity });
    return NextResponse.json(auth);
  } catch (err) {
    if (err instanceof RoomFullError) return NextResponse.json({ error: 'room full' }, { status: 403 });
    throw err;
  }
}
