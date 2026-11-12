import { withPlayer } from '@/lib/api';
import { game } from '@/lib/game';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return withPlayer(request, (p, body) => game().house.buyout({ listingId: String(body.listingId), buyerId: p.id, buyer: { name: p.name } }));
}
