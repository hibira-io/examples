'use client';

import { useEffect, useState } from 'react';
import Sparkline from './Sparkline';
import { usePolling, usePush, type Connection, type Live } from './useStats';
import { STRINGS, type Lang } from '@/lib/strings';

const WINDOW = 60;

type Props = { lang: Lang } & ({ mode: 'poll' } | ({ mode: 'push' } & Connection));

export default function Dashboard(props: Props) {
  return props.mode === 'push' ? <PushDashboard {...props} /> : <PollingDashboard lang={props.lang} />;
}

function PollingDashboard({ lang }: { lang: Lang }) {
  return <View live={usePolling()} lang={lang} mode="poll" />;
}

function PushDashboard({ lang, ...connection }: Connection & { lang: Lang }) {
  return <View live={usePush(connection)} lang={lang} mode="push" />;
}

function View({ live, lang, mode }: { live: Live; lang: Lang; mode: 'poll' | 'push' }) {
  const t = STRINGS[lang];
  const { stats, viewers } = live;
  const [history, setHistory] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (stats) setHistory((prev) => [...prev, stats.rps].slice(-WINDOW));
  }, [stats]);

  // Ticks four times a second so the "updated … ago" badge keeps counting.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const age = stats ? Math.max(0, now - stats.at) / 1000 : null;
  const freshness = age === null ? 'waiting' : age < 1.6 ? 'fresh' : age < 3 ? 'late' : 'stale';

  return (
    <main className={`dashboard mode-${mode}`}>
      <header>
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{mode === 'push' ? t.push : t.polling}</p>
        </div>
        <span className={`age age-${freshness}`} data-age={age?.toFixed(1)}>
          {age === null ? t.waiting : t.updated(age.toFixed(1))}
        </span>
      </header>

      <section className="kpis">
        <Kpi label={t.rps} value={stats ? stats.rps.toLocaleString() : '–'} />
        <Kpi label={t.errors} value={stats ? `${(stats.errorRate * 100).toFixed(2)}%` : '–'} />
        <Kpi label={t.p95} value={stats ? `${stats.p95} ms` : '–'} />
        <Kpi label={t.watching} value={viewers === null ? t.unknown : viewers.toLocaleString()} id="watching" />
      </section>

      <section className="card">
        <h2>{t.chart}</h2>
        <Sparkline values={history} empty={t.waiting} />
      </section>
    </main>
  );
}

function Kpi({ label, value, id }: { label: string; value: string; id?: string }) {
  return (
    <div className="card kpi" id={id}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
