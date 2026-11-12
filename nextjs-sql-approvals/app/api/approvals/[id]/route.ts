import { NextResponse } from 'next/server';
import { configured, hibira } from '@/lib/hibira';

export const runtime = 'nodejs';

// Reads an answer once, after the channel event said it changed.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!configured()) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const { id } = await params;
  if (!/^apr_[a-z0-9]{1,36}$/.test(id)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const res = await hibira().get({ path: `/approvals/${id}` });
  const a = (await res.json()) as { approval_id: string; status: string; choice?: string; comment?: string };
  return NextResponse.json({ approval_id: a.approval_id, status: a.status, choice: a.choice, comment: a.comment });
}
