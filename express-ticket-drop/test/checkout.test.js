import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../lib/db.js';

test('read-then-write oversells under concurrency', async () => {
  const db = createDb(5);
  let sold = 0;
  await Promise.all(Array.from({ length: 50 }, async () => {
    const left = await db.query((d) => d.remaining);
    if (left <= 0) return;
    await db.query((d) => { d.remaining--; });
    sold++;
  }));
  assert.ok(sold > 5);
});

test('taking a seat in one step never oversells', async () => {
  const db = createDb(5);
  let sold = 0;
  await Promise.all(Array.from({ length: 50 }, async () => {
    if (await db.query((d) => (d.remaining > 0 ? d.remaining-- : 0))) sold++;
  }));
  assert.equal(sold, 5);
  assert.equal(db.peek(), 0);
});
