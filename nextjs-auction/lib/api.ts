import { NextResponse } from 'next/server';
import { AuctionError } from '@hibira-io/auction/server';
import { configured } from './hibira';
import { player, type Player } from './game';

// The demo has no sign-in: each browser makes up a player id and keeps it.
// A real game takes the player from its own session here, never from the
// request body.
export async function withPlayer(request: Request, fn: (p: Player, body: Record<string, unknown>) => Promise<unknown>) {
  if (!configured()) {
    return NextResponse.json({ error: 'not_configured', message: 'Set the HIBIRA_* variables in .env.local' }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid', message: 'expected JSON' }, { status: 400 });
  }
  const id = String(body.player ?? '');
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) {
    return NextResponse.json({ error: 'invalid', message: 'missing player id' }, { status: 400 });
  }
  const p = player(id, String(body.name ?? '').trim().slice(0, 20));
  try {
    const result = await fn(p, body);
    return NextResponse.json({ result: result ?? null, me: view(p) });
  } catch (err) {
    if (err instanceof AuctionError) {
      return NextResponse.json({ error: err.code, message: err.message, me: view(p) }, { status: err.status });
    }
    throw err;
  }
}

export function view(p: Player) {
  return { id: p.id, name: p.name, gold: p.gold, held: p.held, bag: p.bag };
}
