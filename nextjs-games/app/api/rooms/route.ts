import { NextResponse } from 'next/server';
import { listRooms } from '@hibira-io/lobby/server';
import { configured, hibira } from '@/lib/hibira';
import { ROOM_GAMES, type RoomGame } from '@/lib/games';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A game's open rooms (?game=draw or four) and how many players are in each,
// from the HTTP API. Rooms exist while someone is in them.
export async function GET(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const game = ROOM_GAMES[new URL(request.url).searchParams.get('game') as RoomGame];
  if (!game) return NextResponse.json({ error: 'unknown game' }, { status: 404 });
  return NextResponse.json(await listRooms(hibira(), { prefix: game.prefix }));
}
