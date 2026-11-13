import { configured, host, port, tls } from '@/lib/hibira';
import QueueView, { type View } from '@/components/QueueView';
import Setup from '@/components/Setup';

// One of the two pages (get in line, give codes), with this app's settings.
export default function QueuePage({ view }: { view: View }) {
  if (!configured()) {
    return <Setup />;
  }
  return <QueueView appKey={process.env.NEXT_PUBLIC_HIBIRA_APP_KEY!} host={host} port={port} tls={tls} view={view} turnstile={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />;
}
