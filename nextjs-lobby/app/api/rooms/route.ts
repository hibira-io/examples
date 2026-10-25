import { NextResponse } from 'next/server';
import { listRooms } from '@hibira-io/lobby/server';
import { configured, hibira } from '@/lib/hibira';
import { ROOM_PREFIX } from '@/lib/game';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Open rooms and how many players are in each, from the HTTP API. Rooms
// exist while someone is in them, so there is nothing to create or delete.
export async function GET() {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  return NextResponse.json(await listRooms(hibira(), { prefix: ROOM_PREFIX }));
}
