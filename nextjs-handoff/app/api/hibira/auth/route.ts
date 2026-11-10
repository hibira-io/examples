import { NextResponse } from 'next/server';
import { authorizeHandoff } from '@hibira-io/handoff/server';
import { configured, hibira } from '@/lib/hibira';

export const runtime = 'nodejs';

// Authorizes a handoff channel: presence-handoff-<code>, with two seats, the
// desktop page and one phone. The code is 128 random bits from the QR code,
// so only the phone that scanned it can join. A real app also checks that
// the signed-in user owns the desktop page's session.
export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const form = await request.formData();
  const auth = await authorizeHandoff(hibira(), {
    socketId: String(form.get('socket_id') ?? ''),
    channel: String(form.get('channel_name') ?? ''),
    userId: String(form.get('user_id') ?? ''),
    role: String(form.get('role') ?? ''),
    device: String(form.get('device') ?? ''),
  });
  return auth ? NextResponse.json(auth) : NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
