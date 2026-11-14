import { readStats } from '../lib/db';
import { hibira, STATS_CHANNEL } from '../lib/hibira';

// Push mode: one query a second, however many people are watching.
// Hibira delivers the result to every open dashboard.
setInterval(async () => {
  const stats = await readStats();
  await hibira().trigger(STATS_CHANNEL, 'stats', stats);
}, 1000);

console.log(`Publishing to ${STATS_CHANNEL} once a second`);
