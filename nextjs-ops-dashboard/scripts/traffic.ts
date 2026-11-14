import { db } from '../lib/db';

// Made-up API traffic, about 350 requests a second, so the numbers move.
const ROUTES = ['/api/checkout', '/api/cart', '/api/search', '/api/login', '/api/orders'];

setInterval(async () => {
  const n = 300 + Math.floor(Math.random() * 100);
  const params: (string | number)[] = [];
  const rows: string[] = [];
  for (let i = 0; i < n; i++) {
    const status = Math.random() < 0.02 ? 500 : 200;
    const ms = Math.round(20 + Math.random() ** 3 * 800);
    const p = params.push(ROUTES[i % ROUTES.length], status, ms);
    rows.push(`(now(), $${p - 2}, $${p - 1}, $${p})`);
  }
  await db().query(`insert into requests (at, route, status, ms) values ${rows.join(',')}`, params);
}, 1000);

console.log('Inserting made-up traffic into requests');
