import { AuctionError } from '@hibira-io/auction/server';
import { withPlayer } from '@/lib/api';
import { game } from '@/lib/game';
import { ITEM } from '@/lib/items';

export const runtime = 'nodejs';

// Selling takes the item out of the bag first, so it cannot be sold twice;
// settle() puts it back if nobody buys it.
export async function POST(request: Request) {
  return withPlayer(request, async (p, body) => {
    const i = p.bag.findIndex((it) => it.uid === body.uid);
    if (i < 0) throw new AuctionError('invalid', 'that item is not in your bag');
    const item = p.bag[i];
    const value = ITEM[item.type].value;
    const startPrice = Math.max(1, Math.round(value * 0.6));
    p.bag.splice(i, 1);
    try {
      return await game().house.list({
        sellerId: p.id,
        seller: { name: p.name },
        item: { ...item },
        startPrice,
        buyout: Math.round(value * 1.5),
        duration: 2 * 60_000,
      });
    } catch (err) {
      p.bag.splice(i, 0, item);
      throw err;
    }
  });
}
