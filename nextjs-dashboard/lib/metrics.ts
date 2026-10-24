export const CHANNEL = 'dashboard';
export const VIEWERS_CHANNEL = 'presence-large-dashboard-viewers';

export interface Order {
  id: string;
  city: string;
  plan: string;
  amount: number;
  at: number;
}

export interface Tick {
  at: number;
  /** Orders in this tick. */
  orders: Order[];
  /** Visitors on the shop right now. */
  visitors: number;
}

const CITIES = ['Tokyo', 'Taipei', 'Seoul', 'Hong Kong', 'Singapore', 'Bangkok', 'Ho Chi Minh City', 'Osaka', 'Manila', 'Jakarta'];
const PLANS: [string, number][] = [['Starter', 29], ['Pro', 79], ['Business', 249], ['Scale', 599]];

let visitors = 1200;

/** Made-up shop traffic for the demo. */
export function nextTick(now = Date.now()): Tick {
  visitors = Math.max(200, Math.round(visitors + (Math.random() - 0.5) * 120));
  const count = Math.random() < 0.35 ? 0 : 1 + Math.floor(Math.random() * 3);
  const orders = Array.from({ length: count }, (_, i) => {
    const [plan, amount] = PLANS[Math.floor(Math.random() ** 2 * PLANS.length)];
    return {
      id: `${now.toString(36)}-${i}`,
      city: CITIES[Math.floor(Math.random() * CITIES.length)],
      plan,
      amount,
      at: now,
    };
  });
  return { at: now, orders, visitors };
}
