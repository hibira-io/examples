import { NextResponse } from 'next/server';
import { readStats } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Polling mode: every open dashboard calls this once a second,
// so 200 viewers run the same query 200 times a second.
export async function GET() {
  return NextResponse.json(await readStats());
}
