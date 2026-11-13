import { configured, host, port, tls } from '@/lib/hibira';
import QueueView from '@/components/QueueView';
import Setup from '@/components/Setup';

// Read the environment on each request, so a .env.local added while the
// dev server runs takes effect after a reload.
export const dynamic = 'force-dynamic';

export default function Page() {
  if (!configured()) {
    return <Setup />;
  }
  return <QueueView appKey={process.env.NEXT_PUBLIC_HIBIRA_APP_KEY!} host={host} port={port} tls={tls} />;
}
