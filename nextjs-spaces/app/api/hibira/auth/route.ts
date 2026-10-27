import { NextResponse } from 'next/server';
import { configured, hibira } from '@/lib/hibira';
import { DOC_PREFIX, validCode } from '@/lib/plan';

export const runtime = 'nodejs';

// Authorizes a subscription to a plan's presence channel. A space needs
// nothing more than an ordinary presence auth: the user's ID and the info
// everyone sees. This demo trusts the name and ID the browser sends; a real
// app takes them from its own session and checks the user may open the plan.
export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const form = await request.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  const userId = String(form.get('user_id') ?? '').slice(0, 64);
  const name = String(form.get('name') ?? '').trim().slice(0, 20) || 'Guest';
  if (!channel.startsWith(DOC_PREFIX) || !validCode(channel.slice(DOC_PREFIX.length)) || !userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json(hibira().authorizeChannel(socketId, channel, { user_id: userId, user_info: { name } }));
}
