import { configured, host, port, tls } from '@/lib/hibira';
import Console from '@/components/Console';
import Setup from '@/components/Setup';

// Read the environment on each request, so a .env.local added while the
// dev server runs takes effect after a reload.
export const dynamic = 'force-dynamic';

export default function Page() {
  if (!configured()) return <Setup />;
  return <Console config={{ appKey: process.env.NEXT_PUBLIC_HIBIRA_APP_KEY!, host, port, tls }} />;
}
