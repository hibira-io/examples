import { withPlayer } from '@/lib/api';

export const runtime = 'nodejs';

/** The player's gold and bag (created on the first call). */
export async function POST(request: Request) {
  return withPlayer(request, async () => null);
}
