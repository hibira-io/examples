import { NextResponse } from 'next/server';
import { configured } from '@/lib/hibira';
import { game } from '@/lib/game';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// What AuctionHouse loads on every (re)subscription: open listings, recent
// sales, price history and the server's clock.
export async function GET() {
  if (!configured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  return NextResponse.json(await game().house.snapshot());
}
