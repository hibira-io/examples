'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Handoff, deviceName, importKey, newSession, type Peer, type Transport } from '@/lib/handoff';
import { connect, RELAY_CHUNK, type Config } from '@/lib/client';
import { BASE_PATH } from '@/lib/demo';
import { useT } from './I18n';

interface Item {
  id: string;
  thumb: string;
  url?: string;
  progress: number;
}

// The desktop page: an expense form whose receipt photos come from the
// phone. It makes a fresh code and key on every load and shows them as a QR
// code until a phone joins.
export default function Desk(config: Config) {
  const t = useT();
  const [session, setSession] = useState<{ link: string; qr: string } | null>(null);
  const [round, setRound] = useState(0);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [transport, setTransport] = useState<Transport>('relay');
  const [items, setItems] = useState<Item[]>([]);
  const [refused, setRefused] = useState(false);
  const [copied, setCopied] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    let handoff: Handoff | undefined;
    let pusher: ReturnType<typeof connect> | undefined;
    let stopped = false;
    setPeer(null);
    setRefused(false);
    (async () => {
      const { code, key } = await newSession();
      const link = `${location.origin}${BASE_PATH}/phone/?s=${code}${langParam()}#k=${key}`;
      const qr = await QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
      if (stopped) return;
      setSession({ link, qr });
      const me = crypto.randomUUID();
      pusher = connect(config, me, 'desk', deviceName());
      handoff = new Handoff({
        pusher,
        code,
        key: await importKey(key),
        me,
        role: 'desk',
        relayChunk: RELAY_CHUNK,
        onPeer: setPeer,
        onTransport: setTransport,
        onRefused: () => setRefused(true),
        onIncoming: (f) => setItems((list) => [{ id: f.id, thumb: f.thumb, progress: 0 }, ...list]),
        onProgress: (id, ratio) => setItems((list) => list.map((i) => (i.id === id ? { ...i, progress: ratio } : i))),
        onFile: (id, blob) => {
          const url = URL.createObjectURL(blob);
          urls.current.push(url);
          setItems((list) => list.map((i) => (i.id === id ? { ...i, url, progress: 1 } : i)));
        },
      });
    })();
    return () => {
      stopped = true;
      handoff?.close();
      pusher?.disconnect();
    };
  }, [config, round]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const copy = () => {
    if (!session) return;
    navigator.clipboard?.writeText(session.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <main className="page desk">
      <header>
        <h1>{t.title}</h1>
        <p className="muted">{t.intro}</p>
      </header>
      <div className="desk-grid">
        <section className="card form">
          <label>
            <span>{t.merchant}</span>
            <input placeholder={t.merchantHint} />
          </label>
          <div className="row">
            <label>
              <span>{t.amount}</span>
              <input inputMode="decimal" placeholder="1,280" />
            </label>
            <label>
              <span>{t.date}</span>
              <input placeholder="2026-11-10" />
            </label>
          </div>
          <label>
            <span>{t.notes}</span>
            <textarea rows={2} />
          </label>
          <h2>{t.receipts}</h2>
          <ul className={`receipts${items.length ? '' : ' empty'}`}>
            {items.map((i) => (
              <li key={i.id} className={`receipt${i.url ? ' landed' : ''}`}>
                <img src={i.url ?? i.thumb} alt="" className={i.url ? '' : 'blur'} />
                {!i.url && (
                  <svg className="ring" viewBox="0 0 36 36" aria-hidden>
                    <circle cx="18" cy="18" r="15" />
                    <circle cx="18" cy="18" r="15" className="done" style={{ strokeDashoffset: 94.25 * (1 - i.progress) }} />
                  </svg>
                )}
                {i.url && (
                  <span className="receipt-actions">
                    <a className="icon" href={i.url} target="_blank" rel="noreferrer" title={t.openFull} aria-label={t.openFull}>
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M14 4h6v6M20 4l-8 8M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
                      </svg>
                    </a>
                    <button
                      className="icon"
                      title={t.remove}
                      aria-label={t.remove}
                      onClick={() => setItems((list) => list.filter((x) => x.id !== i.id))}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </span>
                )}
              </li>
            ))}
            {!items.length && <li className="placeholder">{peer ? t.shootHint : t.scanTitle}</li>}
          </ul>
        </section>

        <aside className={`card pair${peer ? ' paired' : ''}`}>
          {refused ? (
            <>
              <p className="notice">{t.inUse}</p>
              <button onClick={() => setRound((r) => r + 1)}>{t.newCode}</button>
            </>
          ) : peer ? (
            <>
              <div className="phone-icon" aria-hidden>
                <svg viewBox="0 0 24 24">
                  <rect x="6" y="2" width="12" height="20" rx="2.5" />
                  <path d="M10.5 18.5h3" />
                </svg>
              </div>
              <p className="device">{t.connected(peer.device)}</p>
              <p className="muted">{t.shootHint}</p>
              <p className="badges">
                <span className={`badge ${transport}`} title={transport === 'direct' ? t.directTip : t.relayTip}>
                  {transport === 'direct' ? t.direct : t.relay}
                </span>
                <span className="badge lock" title={t.e2eTip}>
                  {t.e2e}
                </span>
              </p>
            </>
          ) : (
            <>
              <h2>{t.scanTitle}</h2>
              <div className="qr" dangerouslySetInnerHTML={{ __html: session?.qr ?? '' }} />
              <p className="muted small">{t.scanHint}</p>
              <p className="muted small">
                {t.noPhone}{' '}
                <button className="link" onClick={copy} disabled={!session}>
                  {copied ? t.copied : t.copy}
                </button>
              </p>
              <p className="badges">
                <span className="badge lock" title={t.e2eTip}>
                  {t.e2e}
                </span>
              </p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

// The phone page opens in the same language as this one.
function langParam(): string {
  const lang = document.documentElement.lang;
  return lang ? `&lang=${encodeURIComponent(lang)}` : '';
}
