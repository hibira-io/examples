import { NextResponse } from 'next/server';
import { classifySql, sqlFingerprint } from '@hibira-io/approvals/sql';
import { approvalText } from '@/lib/approval-text';
import { configured, hibira } from '@/lib/hibira';

export const runtime = 'nodejs';

const CHANNEL = /^private-sqlgate-[A-Za-z0-9_-]{22}$/;

// Sends one change for approval through Hibira's approvals HTTP API. The
// supervisor sees the exact statement, the estimated rows and its SHA-256
// on the hosted page; the answer is announced on the page's private
// channel. Only the statement and its preview leave this server: no
// database credentials, no rows.
export async function POST(request: Request) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { sql?: unknown; rows?: unknown; plan?: unknown; channel?: unknown; lang?: unknown } | null;
  const sql = typeof body?.sql === 'string' ? body.sql : '';
  const rows = Number.isInteger(body?.rows) ? Number(body!.rows) : null;
  const channel = typeof body?.channel === 'string' ? body.channel : '';
  if (!sql || sql.length > 2000 || classifySql(sql) !== 'write' || !CHANNEL.test(channel)) {
    return NextResponse.json({ error: 'send one change of at most 2000 characters, and the page channel' }, { status: 400 });
  }
  const text = approvalText(String(body?.lang ?? 'en'));
  const fingerprint = await sqlFingerprint(sql);
  const plan = typeof body?.plan === 'string' && body.plan ? `${text.plan}: ${body.plan.slice(0, 1000)}` : null;
  const details = [sql.trim(), `${text.rows}: ${rows ?? '?'}`, plan, `SHA-256: ${fingerprint}`].filter(Boolean).join('\n\n');
  const approval = {
    title: text.title,
    details,
    options: [text.approve, text.reject],
    channel,
    expires_in_minutes: 15,
    agent: 'SQL console',
  };
  // pusher's post() JSON-encodes the body itself; its typings say string.
  const res = await hibira().post({ path: '/approvals', body: approval as unknown as string });
  const created = (await res.json()) as { approval_id: string; url: string; expires_at: string };
  return NextResponse.json({ approval_id: created.approval_id, url: created.url, expires_at: created.expires_at, fingerprint });
}
