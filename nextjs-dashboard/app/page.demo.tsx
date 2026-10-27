'use client';

import { useEffect, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import { useT } from '@/components/I18n';
import { DEMO_API } from '@/lib/demo';

// The hosted demo: the app key and host come from the demo backend, which
// keeps the demo app's secret (page.tsx reads them from .env.local).
export default function DemoPage() {
  const t = useT();
  const [config, setConfig] = useState<{ key: string; host: string; port: number; tls: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${DEMO_API}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setConfig, () => setFailed(true));
  }, []);

  if (failed) {
    return (
      <main className="dashboard">
        <p className="error">{t.demoUnavailable}</p>
      </main>
    );
  }
  if (!config) return null;
  return <Dashboard appKey={config.key} host={config.host} port={config.port} tls={config.tls} />;
}
