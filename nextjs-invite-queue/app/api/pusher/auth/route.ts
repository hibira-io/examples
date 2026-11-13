import { NextResponse } from 'next/server';
import { configured, hibira } from '@/lib/hibira';
import { bearer, queue } from '@/lib/server';

export const runtime = 'nodejs';

// Signs a subscription to the person's own private channel only
// (private-invite-queue-<their user id>), for the session in the
// Authorization header.
export async function POST(request: Request) {
  if (!configured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const form = new URLSearchParams(await request.text());
  const socketId = form.get('socket_id') ?? '';
  const channel = form.get('channel_name') ?? '';
  if (!(await queue().mayJoin(bearer(request), channel))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(hibira().authorizeChannel(socketId, channel));
}
