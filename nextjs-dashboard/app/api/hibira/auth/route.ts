import { NextResponse } from 'next/server';
import { configured, hibira } from '@/lib/hibira';
import { VIEWERS_CHANNEL } from '@/lib/metrics';

export const runtime = 'nodejs';

const NAMES = ['Aiko', 'Bao', 'Chen', 'Dara', 'Emi', 'Farid', 'Ga-eun', 'Hana', 'Indra', 'Jun'];

// Authorizes the viewers channel. A real app checks its own session here
// and uses the signed-in user's ID; this demo makes up an anonymous viewer.
export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const form = await request.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  if (channel !== VIEWERS_CHANNEL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const id = crypto.randomUUID();
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  return NextResponse.json(hibira().authorizeChannel(socketId, channel, { user_id: id, user_info: { name } }));
}
