// Asking for an approval and reading the answer: this app's API routes
// (app/api/approvals), or the hosted demo's backend, which holds the demo
// app's secret. Both call Hibira's approvals HTTP API; the supervisor
// answers on the Hibira-hosted page, and the decision arrives as an
// "approval" event on the private channel given here.
import { DEMO_API } from './demo';

export interface Requested {
  approval_id: string;
  url: string;
  fingerprint: string;
  expires_at: string;
}

export interface Answer {
  approval_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  choice?: string;
  comment?: string;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`);
  return res.json() as Promise<T>;
}

export function requestApproval(p: { sql: string; suggestion?: string; rows: number; plan: string; channel: string; lang: string }): Promise<Requested> {
  const body = DEMO_API
    ? { statement: p.suggestion, rows: p.rows, channel: p.channel, lang: p.lang }
    : { sql: p.sql, rows: p.rows, plan: p.plan, channel: p.channel, lang: p.lang };
  return call(DEMO_API ? `${DEMO_API}/sqlgate/approvals` : '/api/approvals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Reads the answer once, to confirm what the channel event said. */
export function getApproval(id: string): Promise<Answer> {
  return call(DEMO_API ? `${DEMO_API}/sqlgate/approvals/${encodeURIComponent(id)}` : `/api/approvals/${encodeURIComponent(id)}`);
}
