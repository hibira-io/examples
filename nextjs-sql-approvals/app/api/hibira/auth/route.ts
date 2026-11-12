import { NextResponse } from 'next/server';
import { configured, hibira } from '@/lib/hibira';

export const runtime = 'nodejs';

const CHANNEL = /^private-sqlgate-[A-Za-z0-9_-]{22}$/;

// Authorizes the page's private channel, where the approval events arrive.
// A real app also checks that the signed-in user owns this console session.
export async function POST(request: Request) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const form = await request.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  if (!/^\d+\.\d+$/.test(socketId) || !CHANNEL.test(channel)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json(hibira().authorizeChannel(socketId, channel));
}
