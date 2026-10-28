'use client';

import { useEffect, useState } from 'react';
import { useT } from './I18n';
import { DEMO_API } from '@/lib/demo';
import type { Config } from '@/lib/connect';

// The hosted demo: the app key and host come from the demo backend, which
// keeps the demo app's secret (page.tsx reads them from .env.local).
export default function DemoGate({ children }: { children: (config: Config) => React.ReactNode }) {
  const t = useT();
  const [config, setConfig] = useState<Config | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${DEMO_API}/config`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c) => setConfig({ appKey: c.key, host: c.host, port: c.port, tls: c.tls }), () => setFailed(true));
  }, []);

  if (failed) {
    return (
      <main className="page">
        <p className="notice">{t.demoUnavailable}</p>
      </main>
    );
  }
  return config ? children(config) : null;
}
