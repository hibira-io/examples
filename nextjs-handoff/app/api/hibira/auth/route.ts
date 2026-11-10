import { NextResponse } from 'next/server';
import { configured, hibira } from '@/lib/hibira';
import { CHANNEL_PREFIX, validCode } from '@/lib/handoff';

export const runtime = 'nodejs';

const ROLES = new Set(['desk', 'phone']);

// Authorizes a handoff channel: presence-handoff-<code>, with two seats, the
// desktop page and one phone. The code is 128 random bits from the QR code,
// so only the phone that scanned it can join. A real app also checks that
// the signed-in user owns the desktop page's session.
export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const form = await request.formData();
  const socketId = String(form.get('socket_id') ?? '');
  const channel = String(form.get('channel_name') ?? '');
  const userId = String(form.get('user_id') ?? '').slice(0, 64);
  const role = String(form.get('role') ?? '');
  const device = String(form.get('device') ?? '').replace(/[^\w .·-]/g, '').trim().slice(0, 40);
  if (!channel.startsWith(CHANNEL_PREFIX) || !validCode(channel.slice(CHANNEL_PREFIX.length)) || !userId || !ROLES.has(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const res = await hibira().get({ path: `/channels/${encodeURIComponent(channel)}`, params: { info: 'user_count' } });
  const info = res.ok ? ((await res.json()) as { user_count?: number }) : {};
  if ((info.user_count ?? 0) >= 2) {
    return NextResponse.json({ error: 'in use' }, { status: 403 });
  }
  return NextResponse.json(hibira().authorizeChannel(socketId, channel, { user_id: userId, user_info: { role, device } }));
}
