// Creates (or updates) the waiting room: 1,200 visitors a minute, and back
// to PUBLIC_URL/drop when it's their turn.
import Pusher from 'pusher';

const room = process.env.HIBIRA_ROOM || 'presale';
const hibira = new Pusher({
  appId: process.env.HIBIRA_APP_ID,
  key: process.env.HIBIRA_KEY,
  secret: process.env.HIBIRA_SECRET,
  host: process.env.HIBIRA_HOST || 'ws.hibira.io',
  port: process.env.HIBIRA_PORT,
  useTLS: process.env.HIBIRA_TLS !== 'false',
});

const res = await hibira.post({
  path: `/waiting_rooms/${room}`,
  body: {
    title: 'Winter tour presale',
    admit_per_minute: Number(process.env.ADMIT_PER_MINUTE || 1200),
    state: 'open',
    notice: '',
    return_urls: [`${process.env.PUBLIC_URL || 'http://localhost:3000'}/drop`],
  },
});
console.log(res.status, await res.text());
