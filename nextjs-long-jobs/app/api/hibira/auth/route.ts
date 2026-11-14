import { NextResponse } from 'next/server';
import { hibira, REPORTS_CHANNEL } from '@/lib/hibira';

export const runtime = 'nodejs';

// Signs subscriptions to the private reports channel. A real app checks its
// own session here, so only its team can read the reports.
export async function POST(request: Request) {
  const form = await request.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  if (channel !== REPORTS_CHANNEL) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json(hibira().authorizeChannel(socketId, channel));
}
