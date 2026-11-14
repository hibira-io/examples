// The parts both versions share: the pages and the monitor's numbers.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createDb } from './db.js';
import { createStats } from './stats.js';

export function createShop() {
  const seats = Number(process.env.SEATS || 500);
  const db = createDb(seats);
  const stats = createStats(seats);
  const app = express();
  app.use(express.json());
  const page = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
  app.get('/', (req, res) => res.redirect('/drop'));
  app.get('/monitor', (req, res) => res.sendFile(page('monitor.html')));
  app.get('/api/stats', (req, res) =>
    res.json(stats.snapshot({ remaining: db.peek(), mode: app.locals.mode, waitStatus: app.locals.waitStatus, ...db.load() })));
  return { app, db, stats, seats, page };
}

export function listen(app) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`${app.locals.mode}: http://localhost:${port}/drop  monitor: http://localhost:${port}/monitor`));
}
