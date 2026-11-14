import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import Pusher from 'pusher';

const hibira = new Pusher({
  appId: process.env.HIBIRA_APP_ID,
  key: process.env.HIBIRA_APP_KEY,
  secret: process.env.HIBIRA_APP_SECRET,
  host: process.env.HIBIRA_HOST || 'ws.hibira.io',
  useTLS: true,
  // Only your server has this key. Hibira relays ciphertext it cannot read.
  encryptionMasterKeyBase64: process.env.HIBIRA_ENCRYPTION_MASTER_KEY,
});

// Demo data. In your app this is your database.
const orders = {
  1042: { owner: 'alice', name: 'Alice Chen', address: '12 Example Lane, Apt 3', phone: '+1 555 0142' },
};
const steps = ['preparing', 'picked_up', 'nearby', 'delivered'];
let step = 0;

// Demo sign-in. In your app, read the user from your session cookie.
const currentUser = (req) => req.headers['x-demo-user'];

async function sendUpdate(id) {
  const { name, address, phone } = orders[id];
  const update = { name, address, phone, status: steps[step++ % steps.length], at: Date.now() };
  // Before: anyone who knows the channel name can subscribe.
  await hibira.trigger(`order-${id}`, 'status', update);
  // After: only users your auth endpoint signs for.
  await hibira.trigger(`private-order-${id}`, 'status', update);
  // After, end to end: Hibira only ever sees ciphertext.
  await hibira.trigger(`private-encrypted-order-${id}`, 'status', update);
}

async function authorize(req, res) {
  const form = new URLSearchParams(await body(req));
  const socketId = form.get('socket_id');
  const channel = form.get('channel_name');
  const id = channel.match(/^private-(?:encrypted-)?order-(\d+)$/)?.[1];
  if (orders[id]?.owner !== currentUser(req)) {
    return send(res, 403, { error: 'This order is not yours' });
  }
  send(res, 200, hibira.authorizeChannel(socketId, channel));
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/pusher/auth') return authorize(req, res);
  if (req.method === 'POST' && url.pathname === '/orders/1042/update') {
    await sendUpdate(1042);
    return send(res, 204);
  }
  if (url.pathname === '/config.json') {
    return send(res, 200, { key: process.env.HIBIRA_APP_KEY, host: process.env.HIBIRA_HOST || 'ws.hibira.io' });
  }
  if (url.pathname === '/pusher.js') {
    return file(res, 'node_modules/pusher-js/dist/web/pusher-with-encryption.min.js', 'text/javascript');
  }
  if (url.pathname === '/app.js') return file(res, 'public/app.js', 'text/javascript');
  return file(res, 'public/index.html', 'text/html');
}).listen(process.env.PORT || 3000, () => console.log(`http://localhost:${process.env.PORT || 3000}`));

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

function send(res, status, json) {
  res.writeHead(status, json ? { 'content-type': 'application/json' } : {});
  res.end(json ? JSON.stringify(json) : undefined);
}

async function file(res, path, type) {
  res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
  res.end(await readFile(new URL(path, import.meta.url)));
}
