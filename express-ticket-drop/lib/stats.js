// Counters for the monitor page.
export function createStats(seats) {
  const s = { seats, sold: 0, errors: 0, soldOut: 0, requests: 0, startedAt: 0, lastAt: 0 };
  const hits = [];
  return {
    hit() {
      const now = Date.now();
      if (!s.startedAt) s.startedAt = now;
      s.lastAt = now;
      s.requests++;
      hits.push(now);
    },
    sold() { s.sold++; },
    error() { s.errors++; },
    soldOut() { s.soldOut++; },
    snapshot(extra = {}) {
      const now = Date.now();
      while (hits.length && hits[0] < now - 1000) hits.shift();
      return { ...s, perSecond: hits.length, oversold: Math.max(0, s.sold - s.seats), ...extra };
    },
  };
}
