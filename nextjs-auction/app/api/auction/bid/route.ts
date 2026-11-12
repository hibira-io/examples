import { withPlayer } from '@/lib/api';
import { game } from '@/lib/game';

export const runtime = 'nodejs';

// The house checks the bid (minimum, not your own listing, still open),
// holds the gold through reserve() and publishes the new price to everyone.
export async function POST(request: Request) {
  return withPlayer(request, (p, body) =>
    game().house.bid({ listingId: String(body.listingId), bidderId: p.id, bidder: { name: p.name }, amount: Number(body.amount) }),
  );
}
