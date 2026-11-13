'use client';

import { useEffect, useState } from 'react';
import QueueView, { type View } from '@/components/QueueView';
import { useT } from '@/components/I18n';
import { DEMO_API } from '@/lib/demo';

// The hosted demo: the app key and host come from the demo backend, which
// keeps the demo app's secret (page.tsx reads them from .env.local).
export default function DemoQueuePage({ view }: { view: View }) {
  const t = useT();
  const [config, setConfig] = useState<{ key: string; host: string; port: number; tls: boolean; turnstile?: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${DEMO_API}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setConfig, () => setFailed(true));
  }, []);

  if (failed) {
    return (
      <main className="queue">
        <p className="error">{t.demoUnavailable}</p>
      </main>
    );
  }
  if (!config) return null;
  return <QueueView appKey={config.key} host={config.host} port={config.port} tls={config.tls} view={view} turnstile={config.turnstile} />;
}
