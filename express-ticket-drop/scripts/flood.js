// Load test: BUYERS people open /drop within SPREAD seconds and try to buy.
// Behind a waiting room, each one does what the hosted page does: take a
// number, ask for a pass until it's their turn, come back and check out.
//   node scripts/flood.js [buyers=3000] [spread=3]
// Against a Hibira server on this machine, LOCAL_IPS=1 sends each buyer from
// its own 127.x.y.z address so the per-visitor rate limits treat them as
// different people.
import http from 'node:http';
import https from 'node:https';

const target = process.env.PUBLIC_URL || 'http://localhost:3000';
const buyers = Number(process.argv[2] || 3000);
const spread = Number(process.argv[3] || 3);
const localIps = process.env.LOCAL_IPS === '1';
const tally = { started: 0, bought: 0, soldOut: 0, failed: 0, queued: 0 };

function request(url, { method = 'GET', body, headers = {}, ip } = {}) {
  const u = new URL(url);
  const lib = u.protocol === 'https:' ? https : http;
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve) => {
    const req = lib.request(u, {
      method,
      localAddress: ip,
      agent: false,
      headers: { ...headers, ...(data ? { 'content-type': 'application/json' } : {}) },
      timeout: 15000,
    }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, json });
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve({ status: 0, headers: {}, json: null }));
    if (data) req.write(data);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function buyer(i) {
  const ip = localIps ? `127.${1 + (i >> 16) % 250}.${(i >> 8) & 255}.${1 + (i & 255) % 254}` : undefined;
  tally.started++;
  let cookie = '';
  const page = await request(target + '/drop', { ip });
  if (page.status === 302) {
    // No pass yet: the shop sent us to the waiting room.
    const wait = new URL(page.headers.location);
    const [, , key, room] = wait.pathname.split('/');
    const api = `${wait.origin}/waitroom/${key}/${room}`;
    const back = wait.searchParams.get('return');
    tally.queued++;
    let join;
    for (;;) {
      join = await request(api + '/join', { method: 'POST', body: {}, ip });
      if (join.status === 200 || join.status === 201) break;
      if (join.status === 409) { tally.queued--; tally.soldOut++; return; }
      await sleep(2000 + Math.random() * 2000);
    }
    let pass;
    for (;;) {
      const r = await request(api + '/pass', { method: 'POST', body: { ticket: join.json.ticket }, ip });
      if (r.status === 200) { pass = r.json.pass; break; }
      if (r.status === 409 && r.json?.error === 'closed') { tally.queued--; tally.soldOut++; return; }
      const st = await request(api, { ip });
      if (st.json?.state === 'closed') { tally.queued--; tally.soldOut++; return; }
      await sleep(2500 + Math.random() * 2000);
    }
    tally.queued--;
    const u = new URL(back);
    u.searchParams.set('hibira_pass', pass);
    const enter = await request(u.toString(), { ip });
    cookie = String(enter.headers['set-cookie'] || '').split(';')[0];
  } else if (page.status !== 200) {
    tally.failed++;
    return;
  }
  const r = await request(target + '/api/buy', { method: 'POST', body: {}, headers: { cookie }, ip });
  if (r.status === 200) tally.bought++;
  else if (r.status === 409) tally.soldOut++;
  else tally.failed++;
}

const t0 = Date.now();
const line = () => `${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s  buyers ${tally.started}  bought ${tally.bought}  sold out ${tally.soldOut}  failed ${tally.failed}  in line ${tally.queued}`;
const timer = setInterval(() => console.log(line()), 500);
const runs = [];
for (let i = 0; i < buyers; i++) {
  runs.push(sleep(Math.random() * spread * 1000).then(() => buyer(i)));
}
await Promise.all(runs);
clearInterval(timer);
console.log(line());
console.log('done');
