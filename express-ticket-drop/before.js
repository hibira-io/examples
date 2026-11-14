// Before: the shop as most of us first write it. No waiting room, and the
// checkout reads the seats left, then writes, in two separate queries.
import { createShop, listen } from './lib/app.js';

const { app, db, stats, page } = createShop();
app.locals.mode = 'before';

app.get('/drop', page('drop.html'));

app.post('/api/buy', async (req, res) => {
  stats.hit();
  try {
    const left = await db.query((d) => d.remaining);
    if (left <= 0) {
      stats.soldOut();
      return res.status(409).json({ error: 'sold_out' });
    }
    // Everyone who read "seats left" before this runs gets a seat.
    await db.query((d) => { d.remaining--; });
    stats.sold();
    res.json({ ok: true });
  } catch {
    stats.error();
    res.status(503).json({ error: 'try_again' });
  }
});

listen(app);
