import { NextResponse } from 'next/server';
import { bearer, queue } from '@/lib/server';

export const runtime = 'nodejs';

// Every queue call (GET /state, POST /auth/start, POST /queue/join, ...)
// goes to lib/invite-queue.js; see its routes.
async function handle(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  let body: unknown;
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const res = await queue().handle({ method: request.method, path: '/' + path.join('/'), body, token: bearer(request), ip });
  return NextResponse.json(res.body, { status: res.status, headers: { 'cache-control': 'no-store' } });
}

export { handle as GET, handle as POST };
