import { Pool } from 'pg';

export interface Stats {
  /** When the query started, in ms. The dashboard shows how old this is. */
  at: number;
  rps: number;
  errorRate: number;
  p95: number;
}

const globalPool = globalThis as unknown as { opsPool?: Pool };

export function db(): Pool {
  globalPool.opsPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 50 });
  return globalPool.opsPool;
}

// Requests per second, error rate and p95 latency over the last five minutes.
export async function readStats(): Promise<Stats> {
  const at = Date.now();
  const { rows } = await db().query(`
    select count(*) filter (where at > now() - interval '1 minute') / 60.0 as rps,
           avg((status >= 500)::int) as error_rate,
           percentile_cont(0.95) within group (order by ms) as p95
      from requests
     where at > now() - interval '5 minutes'`);
  return {
    at,
    rps: Math.round(Number(rows[0].rps)),
    errorRate: Number(rows[0].error_rate),
    p95: Math.round(Number(rows[0].p95)),
  };
}
