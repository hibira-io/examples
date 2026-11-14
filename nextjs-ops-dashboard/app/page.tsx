import Dashboard from '@/components/Dashboard';
import { configured, host, port, tls } from '@/lib/hibira';
import { pickLang } from '@/lib/strings';

export const dynamic = 'force-dynamic';

// /?mode=poll is the "before" (every viewer polls /api/stats),
// /?mode=push is the "after" (run `npm run publisher` alongside it).
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const lang = pickLang(params.lang);
  if (params.mode !== 'push') {
    return <Dashboard mode="poll" lang={lang} />;
  }
  if (!configured()) {
    return (
      <main className="dashboard">
        <p className="hint">Set HIBIRA_APP_ID, HIBIRA_APP_SECRET and NEXT_PUBLIC_HIBIRA_APP_KEY in .env.local, then reload.</p>
      </main>
    );
  }
  return <Dashboard mode="push" lang={lang} appKey={process.env.NEXT_PUBLIC_HIBIRA_APP_KEY!} host={host} port={port} tls={tls} />;
}
