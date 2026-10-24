import { NextResponse } from 'next/server';
import { configured, hibira } from '@/lib/hibira';
import { CHANNEL, nextTick } from '@/lib/metrics';

export const runtime = 'nodejs';

// The simulator in one browser tab calls this once a second. The event goes
// to every open dashboard, not only the tab that asked for it.
export async function POST() {
  if (!configured()) {
    return NextResponse.json({ error: 'Set the HIBIRA_* variables in .env.local' }, { status: 503 });
  }
  const tick = nextTick();
  await hibira().trigger(CHANNEL, 'tick', tick);
  return NextResponse.json({ ok: true });
}
