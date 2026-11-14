import { after } from 'next/server';
import { streamToChannel } from '@hibira-io/react/server';
import { hibira, REPORTS_CHANNEL } from '@/lib/hibira';
import { buildReport } from '@/lib/report';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Answers at once with the job's id. The job keeps running after the
// response is sent, and every line it writes goes out on the channel.
export async function POST(request: Request) {
  const { lang } = await request.json();
  const id = crypto.randomUUID();
  after(() => streamToChannel(hibira(), REPORTS_CHANNEL, buildReport(lang), { id }));
  return Response.json({ id }, { status: 202 });
}
