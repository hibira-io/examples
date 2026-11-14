import { buildReport } from '@/lib/report';

export const runtime = 'nodejs';
// A short limit, like the default of many serverless hosts.
export const maxDuration = 10;

// The way this example replaces: the browser waits for the whole job, and
// the host stops the function when the limit comes first.
export async function POST(request: Request) {
  const { lang } = await request.json();
  let report = '';
  for await (const part of buildReport(lang)) report += part;
  return Response.json({ report });
}
