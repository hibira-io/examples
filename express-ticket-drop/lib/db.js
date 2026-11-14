// Stands in for your database: a pool of 10 connections, each query takes
// 25 ms, and a request that waits more than 1.5 s for a connection fails,
// like a real pool's acquire timeout.
const POOL = 10;
const QUERY_MS = 25;
const ACQUIRE_TIMEOUT_MS = 1500;

export function createDb(seats) {
  const data = { remaining: seats };
  let busy = 0;
  const waiting = [];

  function release() {
    busy--;
    const next = waiting.shift();
    if (next) next();
  }

  async function query(fn) {
    if (busy >= POOL) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.splice(waiting.indexOf(go), 1);
          reject(new Error('connection pool timeout'));
        }, ACQUIRE_TIMEOUT_MS);
        const go = () => { clearTimeout(timer); resolve(); };
        waiting.push(go);
      });
    }
    busy++;
    try {
      await new Promise((r) => setTimeout(r, QUERY_MS));
      return fn(data);
    } finally {
      release();
    }
  }

  return { query, peek: () => data.remaining, load: () => ({ busy, waiting: waiting.length }) };
}
