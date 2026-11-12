'use client';

import { useEffect, useState } from 'react';
import { DEMO_API } from '@/lib/demo';
import type { Config } from './Console';
import { useT } from './I18n';

// The hosted demo: the app key and host come from the demo backend, which
// keeps the demo app's secret (page.tsx reads them from .env.local).
export default function Boot({ render }: { render: (config: Config) => React.ReactNode }) {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${DEMO_API}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: { key: string; host: string; port: number; tls: boolean }) => setConfig({ appKey: c.key, host: c.host, port: c.port, tls: c.tls }), () => setFailed(true));
  }, []);

  if (failed) {
    return (
      <main className="page">
        <p className="notice">{t.demoUnavailable}</p>
      </main>
    );
  }
  return config ? <>{render(config)}</> : null;
}
