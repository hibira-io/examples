import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import PushNotifications from '@pusher/push-notifications-server';

const beams = new PushNotifications({
  instanceId: process.env.HIBIRA_PUSH_INSTANCE_ID,
  secretKey: process.env.HIBIRA_PUSH_SECRET_KEY,
  endpoint: process.env.HIBIRA_PUSH_ENDPOINT || 'ws.hibira.io',
});
beams.protocol = 'https'; // the SDK switches to http when an endpoint is set

const orders = [];
let next = 1043;

// Call this from your checkout or your shop's "order created" webhook.
async function onOrderCreated(order) {
  const title = `New order #${order.id}`;
  const body = `${order.qty} × ${order.item} · ${order.total}`;
  const link = `${order.origin}/#order-${order.id}`;
  // One request reaches every browser, iPhone and Android phone on "orders".
  await beams.publishToInterests(['orders'], {
    web: { notification: { title, body, deep_link: link } },
    apns: { aps: { alert: { title, body } } },
    fcm: { notification: { title, body } },
  });
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css' };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/api/orders') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const { item = 'Oolong tea', qty = 1, total = 'NT$440' } = JSON.parse(raw || '{}');
    const order = { id: next++, item, qty, total, at: Date.now(), origin: url.origin };
    orders.unshift(order);
    try {
      await onOrderCreated(order);
    } catch (err) {
      console.error('push failed', err);
    }
    res.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify(order));
    return;
  }
  if (url.pathname === '/api/orders') {
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(orders));
    return;
  }
  if (url.pathname === '/api/config') {
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      instanceId: process.env.HIBIRA_PUSH_INSTANCE_ID,
      endpoint: 'https://' + (process.env.HIBIRA_PUSH_ENDPOINT || 'ws.hibira.io'),
    }));
    return;
  }
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  try {
    const data = await readFile(join('public', file.replace(/\.\./g, '')));
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(process.env.PORT || 3000, () => console.log(`Orders: http://localhost:${process.env.PORT || 3000}`));
