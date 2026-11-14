'use client';

import { useEffect, useState } from 'react';
import { fill } from '@/lib/strings';
import { useT } from './Providers';

type State = { kind: 'idle' } | { kind: 'waiting'; since: number } | { kind: 'done'; report: string } | { kind: 'failed'; status: string; seconds: number };

// The old way, for comparison: one request that waits for the whole job.
export function Blocking() {
  const { lang, t } = useT();
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.kind !== 'waiting') return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.kind]);

  async function start() {
    const since = Date.now();
    setNow(since);
    setState({ kind: 'waiting', since });
    const res = await fetch('/api/report/blocking', { method: 'POST', body: JSON.stringify({ lang }) }).catch(() => null);
    const seconds = Math.round((Date.now() - since) / 1000);
    if (!res?.ok) return setState({ kind: 'failed', status: res ? `${res.status} ${res.statusText}` : 'network error', seconds });
    setState({ kind: 'done', report: (await res.json()).report });
  }

  return (
    <section className="card">
      <h1>{t.title}</h1>
      <p className="muted">{t.tagline}</p>
      <div className="row">
        <button onClick={start} disabled={state.kind === 'waiting'}>
          {state.kind === 'waiting' ? t.building : t.build}
        </button>
      </div>
      {state.kind === 'waiting' && (
        <div className="wait">
          <span className="spinner" />
          {fill(t.waiting, { s: Math.floor((now - state.since) / 1000) })}
        </div>
      )}
      {state.kind === 'failed' && <div className="error">{fill(t.failed, { status: state.status, s: state.seconds })}</div>}
      {state.kind === 'done' && <pre className="out">{state.report}</pre>}
      {state.kind === 'idle' && <pre className="out"><span className="muted">{t.empty}</span></pre>}
    </section>
  );
}
