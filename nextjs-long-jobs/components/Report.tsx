'use client';

import { useEffect, useState } from 'react';
import { useChannel, useStream } from '@hibira-io/react';
import { REPORTS_CHANNEL } from '@/lib/channels';
import { fill } from '@/lib/strings';
import { useT } from './Providers';

export function Report() {
  const { lang, t } = useT();
  const channel = useChannel(REPORTS_CHANNEL);
  const { stream, text, done } = useStream(channel);
  const [answeredIn, setAnsweredIn] = useState<number | null>(null);
  const now = useClock(Boolean(stream && !done));

  async function start() {
    const t0 = performance.now();
    await fetch('/api/report', { method: 'POST', body: JSON.stringify({ lang }) });
    setAnsweredIn(Math.round(performance.now() - t0));
  }

  const running = Boolean(stream && !done);
  const seconds = stream ? Math.max(0, Math.round(((stream.endedAt ?? now) - stream.startedAt) / 1000)) : 0;

  return (
    <section className="card">
      <h1>{t.title}</h1>
      <p className="muted">{t.tagline}</p>
      <div className="row">
        <button onClick={start} disabled={running}>
          {running ? t.building : t.build}
        </button>
        {answeredIn != null && <span className="pill ok">{fill(t.answered, { ms: answeredIn })}</span>}
        {stream && <span className="pill">{done ? fill(t.doneIn, { s: seconds }) : `${seconds} s`}</span>}
      </div>
      <pre className="out">
        {text || <span className="muted">{t.empty}</span>}
        {running && <span className="caret" />}
      </pre>
      <p className="muted small">{t.tabs}</p>
    </section>
  );
}

function useClock(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [on]);
  return now;
}
