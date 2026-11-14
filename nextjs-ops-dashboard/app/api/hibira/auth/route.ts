import { NextResponse } from 'next/server';
import { configured, hibira, STATS_CHANNEL, VIEWERS_CHANNEL } from '@/lib/hibira';

export const runtime = 'nodejs';

// Signs the stats and viewers channels. A real ops dashboard checks its own
// session here and uses the signed-in user's ID.
export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const form = await request.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  if (channel === STATS_CHANNEL) {
    return NextResponse.json(hibira().authorizeChannel(socketId, channel));
  }
  if (channel === VIEWERS_CHANNEL) {
    const userId = crypto.randomUUID();
    return NextResponse.json(hibira().authorizeChannel(socketId, channel, { user_id: userId, user_info: {} }));
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
