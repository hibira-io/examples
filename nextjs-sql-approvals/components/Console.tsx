'use client';

import { useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import QRCode from 'qrcode';
import { assertApprovedSql, classifySql, sqlFingerprint } from '@hibira-io/approvals/sql';
import { DEMO_API, endpoint } from '@/lib/demo';
import { getApproval, requestApproval, type Requested } from '@/lib/gate';
import { SUGGESTIONS } from '@/lib/requests';
import { openShop, type Shop, type Table } from '@/lib/shop';
import { useLang, useT } from './I18n';

export interface Config {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
}

type Pending = Requested & { sql: string; rows: number; plan: string; qr: string };
type Outcome =
  | { kind: 'ran'; rows: number }
  | { kind: 'rejected'; comment?: string }
  | { kind: 'expired' }
  | { kind: 'mismatch' }
  | { kind: 'error'; message: string };

interface LogLine {
  at: number;
  text: string;
  tone?: 'ok' | 'bad' | 'wait';
}

/** 128 random bits as 22 base64url characters: the page's private channel. */
function channelId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function Console({ config }: { config: Config }) {
  const t = useT();
  const lang = useLang();
  const [shop, setShop] = useState<Shop | null>(null);
  const [sql, setSql] = useState(SUGGESTIONS[0].sql);
  const [suggestion, setSuggestion] = useState<string | undefined>(SUGGESTIONS[0].id);
  const [result, setResult] = useState<Table | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [log, setLog] = useState<LogLine[]>([]);
  const [live, setLive] = useState(false);
  const channel = useRef(`private-sqlgate-${channelId()}`);
  const pendingRef = useRef<Pending | null>(null);
  const ran = useRef(new Set<string>());
  const shopRef = useRef<Shop | null>(null);

  const note = (text: string, tone?: LogLine['tone']) => setLog((l) => [{ at: Date.now(), text, tone }, ...l].slice(0, 12));

  useEffect(() => {
    openShop().then((s) => {
      shopRef.current = s;
      setShop(s);
      setCounts(s.counts());
      setResult(s.read(SUGGESTIONS[0].sql));
    });
  }, []);

  // The answer arrives as an "approval" event on this page's private
  // channel: no polling. The event only says that something changed, so
  // the page reads the answer once to confirm it before it runs anything.
  useEffect(() => {
    const pusher = new Pusher(config.appKey, {
      cluster: 'hkg', // required by pusher-js, unused once wsHost is set
      wsHost: config.host,
      wsPort: config.port,
      wssPort: config.port,
      forceTLS: config.tls,
      enabledTransports: ['ws', 'wss'],
      channelAuthorization: { endpoint: endpoint('/api/hibira/auth', '/sqlgate/auth'), transport: 'ajax' },
    });
    const ch = pusher.subscribe(channel.current);
    ch.bind('pusher:subscription_succeeded', () => setLive(true));
    ch.bind('approval', (e: { id: string; reason: string; status: string }) => {
      const p = pendingRef.current;
      if (!p || e.id !== p.approval_id || e.reason !== 'decided') return;
      settle(p).catch((err) => finish({ kind: 'error', message: String(err?.message ?? err) }));
    });
    pusher.connection.bind('state_change', ({ current }: { current: string }) => setLive(current === 'connected' && ch.subscribed));
    return () => pusher.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Expire on the page too, in case nobody answers.
  useEffect(() => {
    if (!pending) return;
    const ms = new Date(pending.expires_at).getTime() - Date.now();
    const timer = setTimeout(() => pendingRef.current === pending && finish({ kind: 'expired' }), Math.max(0, ms));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  function finish(o: Outcome) {
    pendingRef.current = null;
    setPending(null);
    setOutcome(o);
  }

  async function settle(p: Pending) {
    const answer = await getApproval(p.approval_id);
    if (answer.status === 'pending') return;
    if (answer.status === 'expired') return finish({ kind: 'expired' });
    if (answer.status === 'rejected') {
      note(t.logRejected, 'bad');
      return finish({ kind: 'rejected', comment: answer.comment });
    }
    if (ran.current.has(p.approval_id)) return;
    ran.current.add(p.approval_id);
    note(t.logApproved, 'ok');
    try {
      await assertApprovedSql(p.sql, p.fingerprint);
    } catch {
      return finish({ kind: 'mismatch' });
    }
    const s = shopRef.current!;
    const rows = s.write(p.sql);
    setCounts(s.counts());
    note(t.logRan(rows), 'ok');
    finish({ kind: 'ran', rows });
  }

  const kind = classifySql(sql);
  const demoFreeWrite = Boolean(DEMO_API) && kind === 'write' && !SUGGESTIONS.some((s) => s.id === suggestion && s.sql === sql);

  async function run() {
    if (!shop) return;
    setError(null);
    setOutcome(null);
    if (kind === 'read') {
      try {
        const table = shop.read(sql);
        setResult(table);
        note(t.logRead(table.rows.length));
      } catch (err) {
        setError(String((err as Error).message ?? err));
      }
      return;
    }
    setBusy(true);
    try {
      const { rows, plan } = shop.dryRun(sql);
      const requested = await requestApproval({ sql, suggestion, rows, plan, channel: channel.current, lang });
      // The backend fingerprints the statement it sent; it must be this one.
      if (requested.fingerprint !== (await sqlFingerprint(sql))) throw new Error('fingerprint mismatch');
      const qr = await QRCode.toDataURL(`${requested.url}?lang=${lang}`, { margin: 1, width: 360 });
      const p = { ...requested, sql, rows, plan, qr };
      pendingRef.current = p;
      setPending(p);
      note(t.logRequested(rows), 'wait');
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setBusy(false);
    }
  }

  function pick(id: string) {
    const s = SUGGESTIONS.find((x) => x.id === id)!;
    setSql(s.sql);
    setSuggestion(s.id);
    setError(null);
  }

  function reset() {
    shop?.reset();
    if (shop) {
      setCounts(shop.counts());
      setResult(null);
    }
    setOutcome(null);
    note(t.logReset);
  }

  return (
    <main className="page console">
      <header>
        <h1>{t.title}</h1>
        <p className="muted">{t.intro}</p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>{t.requests}</h2>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s.id} type="button" className={'chip' + (s.id === suggestion && s.sql === sql ? ' active' : '')} onClick={() => pick(s.id)}>
                <span className={`dot ${classifySql(s.sql)}`} aria-hidden="true" />
                {t.suggestions[s.id as keyof typeof t.suggestions]}
              </button>
            ))}
          </div>

          <label className="sql-label" htmlFor="sql">
            SQL
            <span className={`badge ${kind}`}>{kind === 'read' ? t.read : t.write}</span>
          </label>
          <textarea
            id="sql"
            className="sql"
            spellCheck={false}
            value={sql}
            rows={Math.max(4, sql.split('\n').length + 1)}
            onChange={(e) => {
              setSql(e.target.value);
              setSuggestion(undefined);
            }}
          />
          {demoFreeWrite && <p className="notice small">{t.demoChanges}</p>}
          {error && <p className="error small">{error}</p>}
          <div className="actions">
            <button type="button" className="primary" onClick={run} disabled={!shop || busy || Boolean(pending) || demoFreeWrite || !sql.trim()}>
              {kind === 'read' ? t.runRead : t.askApproval}
            </button>
            <span className="muted small">{kind === 'read' ? t.readHint : t.writeHint}</span>
          </div>

          {result && (
            <div className="result">
              <h2>
                {t.result} <span className="muted">· {t.rowsShown(result.rows.length)}</span>
              </h2>
              {result.columns.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {result.columns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.slice(0, 50).map((r, i) => (
                        <tr key={i}>
                          {r.map((v, j) => (
                            <td key={j}>{v === null ? '∅' : String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted small">{t.noRows}</p>
              )}
            </div>
          )}
        </section>

        <aside className="side">
          <section className="card approval" aria-live="polite">
            <h2>
              {t.supervisor}
              <span className={'live' + (live ? ' on' : '')} title={t.liveTip}>
                {live ? t.live : t.connecting}
              </span>
            </h2>
            {pending ? (
              <>
                <p className="state wait">{t.waiting}</p>
                <img className="qr" src={pending.qr} alt={t.qrAlt} width={180} height={180} />
                <p className="muted small">{t.scan}</p>
                <a className="button" href={`${pending.url}?lang=${lang}`} target="_blank" rel="noopener">
                  {t.openPage}
                </a>
                <dl className="facts">
                  <dt>{t.estimated}</dt>
                  <dd>{pending.rows}</dd>
                  <dt>SHA-256</dt>
                  <dd>
                    <code>{pending.fingerprint.slice(0, 16)}…</code>
                  </dd>
                </dl>
              </>
            ) : outcome ? (
              <OutcomeView outcome={outcome} />
            ) : (
              <p className="muted small">{t.idle}</p>
            )}
            <p className="muted small push-note">{t.pushNote}</p>
          </section>

          <section className="card">
            <h2>
              {t.tables}
              <button type="button" className="link small" onClick={reset}>
                {t.reset}
              </button>
            </h2>
            <ul className="counts">
              {Object.entries(counts).map(([name, n]) => (
                <li key={name}>
                  <code>{name}</code>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </section>

          {log.length > 0 && (
            <section className="card">
              <h2>{t.activity}</h2>
              <ol className="log">
                {log.map((l) => (
                  <li key={l.at + l.text} className={l.tone}>
                    <time>{new Date(l.at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                    {l.text}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function OutcomeView({ outcome }: { outcome: Outcome }) {
  const t = useT();
  switch (outcome.kind) {
    case 'ran':
      return (
        <>
          <p className="state ok">{t.approved}</p>
          <p>{t.ran(outcome.rows)}</p>
        </>
      );
    case 'rejected':
      return (
        <>
          <p className="state bad">{t.rejected}</p>
          {outcome.comment && <blockquote>{outcome.comment}</blockquote>}
          <p className="muted small">{t.notRun}</p>
        </>
      );
    case 'expired':
      return <p className="state bad">{t.expired}</p>;
    case 'mismatch':
      return <p className="state bad">{t.mismatch}</p>;
    default:
      return <p className="state bad">{outcome.message}</p>;
  }
}
