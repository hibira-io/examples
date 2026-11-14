// After: the same shop behind a Hibira waiting room.
import Pusher from 'pusher';
import { expressWaitingRoom } from '@hibira-io/waiting-room/server';
import { createShop, listen } from './lib/app.js';

const { app, db, stats, page } = createShop();
app.locals.mode = 'after';
const room = process.env.HIBIRA_ROOM || 'presale';
const waitHost = process.env.HIBIRA_WAIT_HOST || 'https://ws.hibira.io';
// The monitor page reads the line's public status from here.
app.locals.waitStatus = `${waitHost}/waitroom/${process.env.HIBIRA_KEY}/${room}`;
const hibira = new Pusher({
  appId: process.env.HIBIRA_APP_ID,
  key: process.env.HIBIRA_KEY,
  secret: process.env.HIBIRA_SECRET,
  host: process.env.HIBIRA_HOST || 'ws.hibira.io',
  port: process.env.HIBIRA_PORT,
  useTLS: process.env.HIBIRA_TLS !== 'false',
});

// No pass from the waiting room? Off to the queue.
app.use(['/drop', '/api/buy'], expressWaitingRoom({
  appKey: process.env.HIBIRA_KEY,
  secret: process.env.HIBIRA_SECRET,
  room,
  host: process.env.HIBIRA_WAIT_HOST, // leave unset for ws.hibira.io
}));

app.get('/drop', page('drop.html'));

const bought = new Set();
app.post('/api/buy', async (req, res) => {
  stats.hit();
  const { ticketId } = req.hibiraPass;
  if (bought.has(ticketId)) return res.status(409).json({ error: 'already_bought' });
  try {
    // Check and take a seat in one step, like UPDATE ... WHERE remaining > 0.
    const got = await db.query((d) => (d.remaining > 0 ? d.remaining-- : 0));
    if (!got) {
      stats.soldOut();
      await soldOut();
      return res.status(409).json({ error: 'sold_out' });
    }
    bought.add(ticketId);
    stats.sold();
    if (db.peek() === 0) await soldOut();
    res.json({ ok: true });
  } catch {
    stats.error();
    res.status(503).json({ error: 'try_again' });
  }
});

// Sold out: close the room so the people still in line hear it right away.
let closed = false;
async function soldOut() {
  if (closed) return;
  closed = true;
  await hibira.post({ path: `/waiting_rooms/${room}`, body: { state: 'closed', notice: 'Sold out' } });
}

listen(app);
