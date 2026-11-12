// The items of the made-up game, shared by the server and the page. In a real
// game they come from your item database; the auction only needs a type (for
// the price history) and whatever the page shows.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemType {
  type: string;
  icon: Icon;
  rarity: Rarity;
  /** What NPC traders think it is worth, in gold. */
  value: number;
}

export type Icon = 'sword' | 'shield' | 'potion' | 'gem' | 'bow' | 'ring' | 'helm' | 'scroll';

export const ITEMS: ItemType[] = [
  { type: 'iron-sword', icon: 'sword', rarity: 'common', value: 40 },
  { type: 'oak-shield', icon: 'shield', rarity: 'common', value: 35 },
  { type: 'healing-potion', icon: 'potion', rarity: 'common', value: 15 },
  { type: 'hunter-bow', icon: 'bow', rarity: 'rare', value: 120 },
  { type: 'knight-helm', icon: 'helm', rarity: 'rare', value: 150 },
  { type: 'ember-scroll', icon: 'scroll', rarity: 'epic', value: 320 },
  { type: 'moon-ring', icon: 'ring', rarity: 'epic', value: 420 },
  { type: 'dragon-gem', icon: 'gem', rarity: 'legendary', value: 900 },
];

export const ITEM = Object.fromEntries(ITEMS.map((i) => [i.type, i])) as Record<string, ItemType>;

/** What travels in listing.item: the type, plus an id for this one copy. */
export interface ItemRef {
  type: string;
  uid: string;
}
