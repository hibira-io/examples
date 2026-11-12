// The game's side of the auction: wallets, bags and a few NPC traders, all in
// this server process. A real game keeps wallets and inventories in its
// database; the three callbacks below are where it would update them.
//
// The house itself comes from @hibira-io/auction/server. It checks every bid,
// publishes each change once on "auction-main", and calls reserve, release
// and settle so the gold and items move only when the house says so.

import { createAuctionHouse, type AuctionHouseServer } from '@hibira-io/auction/server';
import { hibira } from './hibira';
import { ITEM, ITEMS, type ItemRef } from './items';

export const HOUSE = 'main';
const START_GOLD = 1000;
const BAG_SIZE = 3;
const NPC_LISTINGS = 6;
const MAX_PLAYERS = 5000;

export interface Player {
  id: string;
  name: string;
  /** Spendable gold. */
  gold: number;
  /** Gold held for this player's winning bids. */
  held: number;
  bag: ItemRef[];
  seen: number;
}

const NPCS = ['Brannoc', 'Iselde', 'Old Tamsin', 'Varo the Fence', 'Quill', 'Merrow'];

interface Game {
  house: AuctionHouseServer;
  players: Map<string, Player>;
  uid: number;
}

// One game per server process, kept across hot reloads in development.
const g = globalThis as unknown as { __auctionGame?: Game };

export function game(): Game {
  if (g.__auctionGame) return g.__auctionGame;
  const players = new Map<string, Player>();
  const house = createAuctionHouse({
    pusher: hibira(),
    name: HOUSE,
    // Short auctions so a visit sees a few of them end.
    duration: 3 * 60_000,
    minDuration: 60_000,
    maxDuration: 10 * 60_000,
    extendWithin: 15_000,
    extendBy: 15_000,
    maxEndsAfter: 2 * 60_000,
    reserve: async ({ userId, amount }) => {
      const p = players.get(userId);
      if (!p) return; // an NPC
      if (p.gold < amount) throw new Error('not enough gold');
      p.gold -= amount;
      p.held += amount;
    },
    release: async ({ userId, amount }) => {
      const p = players.get(userId);
      if (!p) return;
      p.gold += amount;
      p.held -= amount;
    },
    settle: async ({ listing }) => {
      const item = listing.item as unknown as ItemRef;
      const seller = players.get(listing.sellerId);
      if (listing.status === 'sold' && listing.bidderId) {
        const buyer = players.get(listing.bidderId);
        if (buyer) {
          buyer.held -= listing.price!;
          buyer.bag.push(item);
        }
        if (seller) seller.gold += listing.price!;
      } else if (seller) {
        seller.bag.push(item); // unsold or cancelled: the item goes back
      }
    },
  });
  house.start();
  const state: Game = { house, players, uid: 0 };
  g.__auctionGame = state;
  setInterval(() => npcTurn(state).catch((err) => console.error('[npc]', err)), 3000).unref?.();
  npcTurn(state).catch(() => {});
  return state;
}

/** The player with this id, created with some gold and a few items on first sight. */
export function player(id: string, name: string): Player {
  const { players } = game();
  let p = players.get(id);
  if (!p) {
    if (players.size >= MAX_PLAYERS) {
      const oldest = [...players.values()].filter((x) => x.held === 0).sort((a, b) => a.seen - b.seen)[0];
      if (oldest) players.delete(oldest.id);
    }
    p = { id, name, gold: START_GOLD, held: 0, bag: Array.from({ length: BAG_SIZE }, () => newItem(pickType())), seen: Date.now() };
    players.set(id, p);
  }
  p.seen = Date.now();
  if (name) p.name = name;
  return p;
}

export function newItem(type: string): ItemRef {
  const s = game();
  s.uid++;
  return { type, uid: `${Date.now().toString(36)}${s.uid.toString(36)}` };
}

// NPC traders keep the house busy: they list items when there are few, and
// bid on auctions that are about to end while the price is still a bargain.
async function npcTurn(s: Game) {
  const { listings } = await s.house.snapshot();
  const npcListings = listings.filter((l) => l.sellerId.startsWith('npc:')).length;
  // Fill the house at once on start, then one new listing per turn.
  const toList = npcListings === 0 ? NPC_LISTINGS : Math.min(1, NPC_LISTINGS - npcListings);
  for (let n = 0; n < toList; n++) {
    const type = pickType();
    const value = ITEM[type].value;
    const npc = pick(NPCS);
    await s.house.list({
      sellerId: `npc:${npc}`,
      seller: { name: npc },
      item: newItem(type) as unknown as Record<string, unknown>,
      startPrice: Math.max(1, Math.round(value * (0.4 + Math.random() * 0.3))),
      buyout: Math.random() < 0.6 ? Math.round(value * (1.4 + Math.random() * 0.4)) : null,
      duration: (90 + Math.floor(Math.random() * 150)) * 1000,
    });
  }
  const now = Date.now();
  for (const l of listings) {
    const value = ITEM[(l.item as unknown as ItemRef).type]?.value ?? 0;
    const closing = l.endsAt - now < 60_000;
    if (!closing || Math.random() > 0.35 || l.minBid > value * 1.15) continue;
    const npc = pick(NPCS);
    if (`npc:${npc}` === l.sellerId || `npc:${npc}` === l.bidderId) continue;
    await s.house.bid({ listingId: l.id, bidderId: `npc:${npc}`, bidder: { name: npc }, amount: l.minBid }).catch(() => {});
    break;
  }
}

function pickType(): string {
  // Common items show up more often than legendary ones.
  const weights = { common: 6, rare: 3, epic: 1.5, legendary: 0.5 };
  const total = ITEMS.reduce((sum, i) => sum + weights[i.rarity], 0);
  let r = Math.random() * total;
  for (const i of ITEMS) {
    r -= weights[i.rarity];
    if (r <= 0) return i.type;
  }
  return ITEMS[0].type;
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
