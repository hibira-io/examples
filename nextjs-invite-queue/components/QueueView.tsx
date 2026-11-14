'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Pusher from 'pusher-js';
import { useLang, useT } from './I18n';
import HeroGlobe from './HeroGlobe';
import Link from 'next/link';
import { track } from './Analytics';
import { ASK_URL, askBrand } from './LiveChat';
import { api, ApiError } from '@/lib/api';
import VendorPanel, { VendorIntro } from './Vendor';
import { VENDOR_STRINGS } from '@/lib/vendor-strings';
import { API, AUTH_URL, BASE_PATH, SIGNUP_URL, SOURCE_URL, iconUrl } from '@/lib/demo';
import type { ErrorCode } from '@/lib/strings';

// The whole page: the line, the email sign-in, giving codes and the chat.
// It reads everything from GET /state and reads it again when Hibira says
// something changed: "state" on the public channel invite-queue, "me" on
// the person's own private channel. Chat messages arrive in full.

type Product = {
  id: string;
  name: string;
  names?: Record<string, string>;
  icon?: string;
  hosts?: string[];
  kind?: 'invite' | 'referral';
  official?: boolean;
  uses?: number;
  open: number;
  waiting: number;
};
type Message = { id: number; uid: string; name: string; text: string; at: number };
type Taken = { id: number; product: string; value: string; takenAt: number; report: 'ok' | 'bad' | null; canReport: boolean };
type Given = { id: number; product: string; state: 'open' | 'offered' | 'taken'; at: number; report: 'ok' | 'bad' | null; uses?: number; taken?: number; offered?: number };
type Me = {
  uid: string;
  email: string;
  name: string;
  admin: boolean;
  blocked: boolean;
  newGiver?: boolean;
  cooldownUntil: number;
  cooldowns?: Record<string, number>;
  entry: null | Place;
  entries?: Place[];
  taken: Taken[];
  given: Given[];
};
type Place = { product?: string; state: 'waiting' | 'offered'; products: string[]; ahead: number; offer: null | { product: string; deadline: number } };
type State = { products: Product[]; waiting: number; served: number; holdHours: number; chat: Message[]; me: Me | null };

const TOKEN = 'invite-queue-token';
const CHANNEL = 'invite-queue';

function readToken() {
  try {
    return localStorage.getItem(TOKEN) ?? '';
  } catch {
    return '';
  }
}

function writeToken(token: string) {
  try {
    if (token) localStorage.setItem(TOKEN, token);
    else localStorage.removeItem(TOKEN);
  } catch {}
}

export default function QueueView({
  appKey,
  host,
  port,
  tls,
  view,
  turnstile = '',
}: {
  appKey: string;
  host: string;
  port: number;
  tls: boolean;
  view: View;
  /** Cloudflare Turnstile site key: when set, sending an email code needs the check. */
  turnstile?: string;
}) {
  const t = useT();
  const lang = useLang();
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [online, setOnline] = useState(0);
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const tokenRef = useRef('');
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const s = await api<State>('/state', tokenRef.current);
      if (tokenRef.current && !s.me) {
        writeToken('');
        tokenRef.current = '';
      }
      setState(s);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // Many people read again after each change: spread them over a moment.
  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(load, 200 + Math.random() * 1500);
  }, [load]);

  useEffect(() => {
    const saved = readToken();
    tokenRef.current = saved;
    load();
  }, [load]);

  const [pusher, setPusher] = useState<Pusher | null>(null);
  useEffect(() => {
    const p = new Pusher(appKey, {
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: tls,
      enabledTransports: ['ws', 'wss'],
      cluster: '',
      channelAuthorization: {
        endpoint: AUTH_URL,
        transport: 'ajax',
        customHandler: ({ socketId, channelName }, callback) => {
          fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${tokenRef.current}` },
            body: new URLSearchParams({ socket_id: socketId, channel_name: channelName }),
          })
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then(
              (data) => callback(null, data),
              (err) => callback(err, null),
            );
        },
      },
    });
    p.connection.bind('state_change', (s: { current: string }) => setLive(s.current === 'connected'));
    // Back after a dropped connection: catch up on what was missed.
    p.connection.bind('connected', load);
    const ch = p.subscribe(CHANNEL);
    ch.bind('pusher:subscription_count', (d: { subscription_count: number }) => setOnline(d.subscription_count));
    ch.bind('state', refreshSoon);
    ch.bind('chat', (m: Message) => setState((s) => (s && !s.chat.some((x) => x.id === m.id) ? { ...s, chat: [...s.chat, m].slice(-100) } : s)));
    ch.bind('chat-removed', ({ id }: { id: number }) => setState((s) => (s ? { ...s, chat: s.chat.filter((m) => m.id !== id) } : s)));
    setPusher(p);
    return () => {
      p.disconnect();
      setPusher(null);
    };
  }, [appKey, host, port, tls, load, refreshSoon]);

  const uid = state?.me?.uid;
  const products = state?.products;
  // A brand picked on the first page (?product=) is the one this page is
  // about: show it instead of every brand again.
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    setChosen(products && view !== 'home' ? chosenProduct(products) : null);
  }, [products, view]);
  useEffect(() => {
    if (!uid || !pusher) return;
    const name = `private-invite-queue-${uid}`;
    const ch = pusher.subscribe(name);
    const seen = { offer: false };
    ch.bind('me', () => {
      api<State>('/state', tokenRef.current).then(
        (s) => {
          setState(s);
          const offer = s.me?.entry?.offer;
          if (offer && !seen.offer) {
            seen.offer = true;
            const p = products?.find((x) => x.id === offer.product);
            notify(t.notifyTitle, t.notifyBody(p?.names?.[lang] || p?.name || offer.product));
          }
        },
        () => {},
      );
    });
    return () => pusher.unsubscribe(name);
  }, [pusher, uid, t, products, lang]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      setError('');
      try {
        return await fn();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'network';
        if (code === 'sign_in') {
          writeToken('');
          tokenRef.current = '';
          load();
        }
        setError(t.errors[code as ErrorCode] ?? t.errors.network);
        return undefined;
      }
    },
    [t, load],
  );

  const call = useCallback(
    async (path: string, body: unknown = {}) => {
      const res = await run(() => api<{ me?: Me } & Record<string, unknown>>(path, tokenRef.current, body));
      if (res?.me) setState((s) => (s ? { ...s, me: res.me! } : s));
      return res;
    },
    [run],
  );

  const signedIn = (newToken: string, me: Me) => {
    writeToken(newToken);
    tokenRef.current = newToken;
    setState((s) => (s ? { ...s, me } : s));
    load();
  };

  const signOut = async () => {
    await api('/auth/logout', tokenRef.current, {}).catch(() => {});
    writeToken('');
    tokenRef.current = '';
    setState((s) => (s ? { ...s, me: null } : s));
  };

  if (failed && !state) {
    return (
      <main className="queue">
        <p className="error">{t.demoUnavailable}</p>
      </main>
    );
  }
  if (!state) return null;
  const me = state.me;
  const name = (id: string) => {
    const p = state.products.find((x) => x.id === id);
    return p?.names?.[lang] || p?.name || id;
  };

  const chosenP = chosen ? state.products.find((p) => p.id === chosen) : undefined;

  return (
    <main className="queue">
      <header className={'hero' + (view === 'home' ? '' : ' hero-compact')}>
        <HeroGlobe />
        <div className="hero-top">
          <img className="hero-logo" src={`${BASE_PATH}/brand/invite-queue.svg`} alt="" width={64} height={64} />
          <span className={'status' + (live ? ' status-connected' : '')}>{live ? t.live : t.offline}</span>
        </div>
        <h1>{t.title}</h1>
        <p className="hero-lead">{t.subtitle}</p>
        <ul className="stats" aria-live="polite">
          <li>
            <strong>{t.online(Math.max(online, 1))}</strong>
          </li>
          <li>
            <strong>{t.inLine(state.waiting)}</strong>
          </li>
          <li>
            <strong>{t.served(state.served)}</strong>
          </li>
        </ul>
      </header>

      {view === 'home' ? (
        <section className="pick" aria-labelledby="pick-title">
          {me?.entry?.state === 'offered' && (
            <Link href="/get" className="turn-banner">
              {t.turnBanner}
            </Link>
          )}
          <h2 id="pick-title">{t.pickTitle}</h2>
          <p className="muted">{t.pickHint}</p>
          <ul className="product-cards pick-cards">
            {state.products.map((p) => (
              <li key={p.id} className={'product-card' + (p.open > 0 ? ' has-codes' : '')}>
                <ProductIcon product={p} size={40} />
                <span className="product-card-name">
                  {name(p.id)}
                  {p.official && <span className="official">{VENDOR_STRINGS[lang].official}</span>}
                </span>
                <span className="product-card-counts">
                  <span>
                    <strong>{p.open}</strong> {t.colCodes}
                  </span>
                  <span>
                    <strong>{p.waiting}</strong> {t.colWaiting}
                  </span>
                </span>
                <span className="pick-actions">
                  <Link href={`/give?product=${encodeURIComponent(p.id)}`} className="button secondary" onClick={() => track('choose', { path: 'give', product: p.id })}>
                    {t.cardShare}
                  </Link>
                  <Link href={`/get?product=${encodeURIComponent(p.id)}`} className="button primary" onClick={() => track('choose', { path: 'get', product: p.id })}>
                    {t.cardGet}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          <p className="pick-more">
            <a className="ask-brand" href={ASK_URL} onClick={askBrand}>
              {t.askBrand}
            </a>
            <Link href="/vendor" className="vendor-link">
              {VENDOR_STRINGS[lang].homeLink}
            </Link>
          </p>
        </section>
      ) : (
        <nav className="tabs">
          <Link href="/get" className={'tab' + (view === 'get' ? ' tab-on' : '')} aria-current={view === 'get' ? 'page' : undefined}>
            {t.lineTitle}
            {view !== 'get' && me?.entry?.state === 'offered' && <span className="tab-alert" aria-hidden="true" />}
          </Link>
          <Link href="/give" className={'tab' + (view === 'give' ? ' tab-on' : '')} aria-current={view === 'give' ? 'page' : undefined}>
            {t.giveTitle}
          </Link>
          <Link href="/vendor" className={'tab' + (view === 'vendor' ? ' tab-on' : '')} aria-current={view === 'vendor' ? 'page' : undefined}>
            {VENDOR_STRINGS[lang].tab}
          </Link>
        </nav>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {view === 'vendor' ? (
        <div className="vendor-page">
          {!me ? (
            <>
              <VendorIntro />
              <SignIn lang={lang} onDone={signedIn} run={run} turnstile={turnstile} />
            </>
          ) : (
            <>
              <Account me={me} call={call} onSignOut={signOut} />
              <VendorPanel token={tokenRef.current} listed={state.products} />
            </>
          )}
        </div>
      ) : (
        <div className="grid">
          <div className="col">

            {view === 'home' ? (
              me && <Account me={me} call={call} onSignOut={signOut} />
            ) : !me ? (
              <>
                {chosenP && (
                  <section className="card chosen" aria-labelledby="chosen-title">
                    <div className="chosen-head">
                      <h2 id="chosen-title">{t.chosenTitle}</h2>
                      <Link href="/" className="chosen-change" title={t.changeBrand} aria-label={t.changeBrand}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
                        </svg>
                      </Link>
                    </div>
                    <div className="chosen-row">
                      <ProductIcon product={chosenP} size={40} />
                      <span className="chosen-main">
                        <span className="product-card-name">
                          {name(chosenP.id)}
                          {chosenP.official && <span className="official">{VENDOR_STRINGS[lang].official}</span>}
                        </span>
                        <span className="product-card-rule">{t.cardRule(chosenP.uses ?? 1)}</span>
                      </span>
                      <span className="product-card-counts">
                        <span>
                          <strong>{chosenP.open}</strong> {t.colCodes}
                        </span>
                        <span>
                          <strong>{chosenP.waiting}</strong> {t.colWaiting}
                        </span>
                      </span>
                    </div>
                  </section>
                )}
                <SignIn lang={lang} onDone={signedIn} run={run} turnstile={turnstile} />
              </>
            ) : (
              <>
                {view === 'get' ? (
                  <>
                    <Line me={me} products={state.products} call={call} name={name} lang={lang} />
                    {me.taken.length > 0 && <TakenList me={me} call={call} name={name} />}
                  </>
                ) : (
                  <Give me={me} products={state.products} call={call} name={name} />
                )}
                <Account me={me} call={call} onSignOut={signOut} />
              </>
            )}

            {view !== 'home' && !chosenP && (
            <section className="card">
              <h2>{t.products}</h2>
              <ul className="product-cards">
                {state.products.map((p) => (
                  <li key={p.id} className={'product-card' + (p.open > 0 ? ' has-codes' : '')}>
                    <ProductIcon product={p} size={40} />
                    <span className="product-card-name">
                      {name(p.id)}
                      {p.official && <span className="official">{VENDOR_STRINGS[lang].official}</span>}
                    </span>
                    <span className="product-card-rule">{t.cardRule(p.uses ?? 1)}</span>
                    <span className="product-card-counts">
                      <span>
                        <strong>{p.open}</strong> {t.colCodes}
                      </span>
                      <span>
                        <strong>{p.waiting}</strong> {t.colWaiting}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <a className="ask-brand" href={ASK_URL} onClick={askBrand}>
                {t.askBrand}
              </a>
            </section>
            )}

            <section className="card rules">
              <h2>{t.rulesTitle}</h2>
              <ul>
                {t.rules(state.holdHours).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className="col">
            <Chat messages={state.chat} me={me} call={call} />
            <section className="card powered">
              <h2>{t.poweredTitle}</h2>
              <p>{t.poweredBody}</p>
              <p className="actions">
                <a className="button primary" href={SIGNUP_URL} onClick={() => track('signup_click', { source: 'invite_queue' })}>
                  {t.poweredCta}
                </a>
                <a href={SOURCE_URL}>{t.poweredSource}</a>
              </p>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function chosenProduct(products: Product[]): string | null {
  const id = new URLSearchParams(window.location.search).get('product');
  return id && products.some((p) => p.id === id) ? id : null;
}

function notify(title: string, body: string) {
  document.title = `● ${title}`;
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body });
  } catch {}
}

type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>;
type Call = (path: string, body?: unknown) => Promise<({ me?: Me } & Record<string, unknown>) | undefined>;

function SignIn({ lang, onDone, run, turnstile }: { lang: string; onDone: (token: string, me: Me) => void; run: Run; turnstile: string }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const human = useTurnstile(turnstile, lang);
  const waiting = human.on && !human.token;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    const ok = await run(() => api('/auth/start', '', { email, lang, human: human.token || undefined }));
    setBusy(false);
    human.reset();
    if (ok) setSent(true);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await run(() => api<{ token: string; me: Me }>('/auth/verify', '', { email, code, lang }));
    if (res) track('login', { method: 'email_code' });
    setBusy(false);
    if (res) onDone(res.token, res.me);
  };

  return (
    <section className="card">
      <h2>{t.signInTitle}</h2>
      <p className="muted small">{t.signInHint}</p>
      {human.on && <div ref={human.ref} className="human" />}
      {!sent ? (
        <form onSubmit={send} className="row">
          <label className="grow">
            <span className="sr-only">{t.email}</span>
            <input type="email" required autoComplete="email" placeholder={t.email} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="primary" disabled={busy || waiting}>
            {t.sendCode}
          </button>
        </form>
      ) : (
        <>
          <p className="small">{t.codeSent(email)}</p>
          <form onSubmit={verify} className="row">
            <label className="grow">
              <span className="sr-only">{t.codeLabel}</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                placeholder={t.codeLabel}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {t.verify}
            </button>
          </form>
          <p className="links small">
            <button type="button" className="link" onClick={() => send()} disabled={busy || waiting}>
              {t.resend}
            </button>
            <button type="button" className="link" onClick={() => (setSent(false), setCode(''))}>
              {t.changeEmail}
            </button>
          </p>
        </>
      )}
    </section>
  );
}

function Account({ me, call, onSignOut }: { me: Me; call: Call; onSignOut: () => void }) {
  const t = useT();
  const [name, setName] = useState(me.name);
  useEffect(() => setName(me.name), [me.name]);
  return (
    <section className="card">
      <p className="row between small">
        <span className="muted">{t.signedInAs(me.email)}</span>
        <button type="button" className="link" onClick={onSignOut}>
          {t.signOut}
        </button>
      </p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          call('/me', { name });
        }}
      >
        <label className="grow">
          <span className="small muted">{t.nameLabel}</span>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="secondary" disabled={name.trim() === me.name}>
          {t.save}
        </button>
      </form>
    </section>
  );
}

function Line({ me, products, call, name, lang }: { me: Me; products: Product[]; call: Call; name: (id: string) => string; lang: string }) {
  const t = useT();
  const places = me.entries ?? (me.entry ? [me.entry] : []);
  const placeOf = (p: Place) => p.product ?? p.products[0];
  const cooldowns = me.cooldowns ?? {};
  const [pick, setPick] = useState('');
  const [ask, setAsk] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const chosen = chosenProduct(products);
    setPick((p) => p || chosen || products[0]?.id || '');
  }, [products]);
  const offers = places.filter((p) => p.offer);
  useEffect(() => {
    if (!offers.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [offers.length]);
  const fmt = (at: number, withDate = false) =>
    new Intl.DateTimeFormat(lang, withDate ? { dateStyle: 'medium', timeStyle: 'short' } : { timeStyle: 'short' }).format(new Date(at));

  const join = async () => {
    if (ask && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission().catch(() => {});
    const joined = await call('/queue/join', { product: pick });
    if (joined) track('join_queue', { products: pick });
  };
  const waitUntil = cooldowns[pick] ?? 0;

  return (
    <>
      {offers.map((p) => {
        const offer = p.offer!;
        const left = Math.max(0, offer.deadline - now);
        const h = Math.floor(left / 3_600_000);
        const m = Math.floor((left % 3_600_000) / 60_000);
        const sec = Math.floor((left % 60_000) / 1000);
        return (
          <section key={offer.product} className="card turn" aria-live="assertive">
            <h2>{t.turnTitle(name(offer.product))}</h2>
            <p className="countdown">
              {h}:{String(m).padStart(2, '0')}:{String(sec).padStart(2, '0')}
            </p>
            <p className="small">{t.turnHint(fmt(offer.deadline))}</p>
            <p className="actions">
              <button className="primary" onClick={() => call('/offer/take', { product: offer.product })}>
                {t.take}
              </button>
              <button className="secondary" onClick={() => call('/offer/pass', { product: offer.product })}>
                {t.pass}
              </button>
            </p>
          </section>
        );
      })}
      {!offers.length && (
        <section className="card">
          <h2>{t.lineTitle}</h2>
          {places.length ? (
            <>
              <p className="small muted">{t.myLines}</p>
              <ul className="my-lines">
                {places.map((p) => {
                  const id = placeOf(p);
                  const product = products.find((x) => x.id === id);
                  return (
                    <li key={id}>
                      {product ? <ProductName product={product} name={name} /> : <span>{name(id)}</span>}
                      <strong className="small">{t.ahead(p.ahead)}</strong>
                      <button className="secondary" onClick={() => call('/queue/leave', { product: id })}>
                        {t.leave}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="small muted">{t.oneLine(name(placeOf(places[0])))}</p>
              <p className="small muted">{t.waitingHint}</p>
            </>
          ) : (
            <div className="stack">
              <div className="field">
                <span className="small muted" id="line-brand">{t.pickProducts}</span>
                <BrandPicker products={products} value={pick} onChange={setPick} name={name} labelledBy="line-brand" />
              </div>
              {waitUntil > 0 ? (
                <p className="small">{t.cooldown(fmt(waitUntil, true))}</p>
              ) : (
                <>
                  <Switch checked={ask} onChange={setAsk} label={t.notifyAsk} />
                  <p className="actions">
                    <button className="primary" disabled={!pick} onClick={join}>
                      {t.join}
                    </button>
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function TakenList({ me, call, name }: { me: Me; call: Call; name: (id: string) => string }) {
  const t = useT();
  const [copied, setCopied] = useState(0);
  const copy = (c: Taken) => {
    navigator.clipboard?.writeText(c.value).then(
      () => {
        setCopied(c.id);
        setTimeout(() => setCopied(0), 1500);
      },
      () => {},
    );
  };
  return (
    <section className="card">
      <h2>{t.yourCodes}</h2>
      <ul className="list">
        {me.taken.map((c) => (
          <li key={c.id}>
            <span className="small muted">{name(c.product)}</span>
            <span className="row">
              <code className="code grow">{c.value}</code>
              <button className="secondary small-button" onClick={() => copy(c)}>
                {copied === c.id ? t.copied : t.copy}
              </button>
            </span>
            {c.report === 'ok' && <span className="small ok">{t.reportedOk}</span>}
            {c.report === 'bad' && <span className="small bad">{t.reportedBad}</span>}
            {c.canReport && (
              <span className="row small">
                <button className="secondary small-button" onClick={() => call('/taken/report', { id: c.id, works: true })}>
                  {t.works}
                </button>
                <button className="secondary small-button" onClick={() => call('/taken/report', { id: c.id, works: false })}>
                  {t.broken}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Give({ me, products, call, name }: { me: Me; products: Product[]; call: Call; name: (id: string) => string }) {
  const t = useT();
  const [product, setProduct] = useState(products[0]?.id ?? '');
  useEffect(() => {
    const chosen = chosenProduct(products);
    if (chosen) setProduct(chosen);
  }, [products]);
  const [text, setText] = useState('');
  const [thanks, setThanks] = useState('');
  const max = products.find((p) => p.id === product)?.uses ?? 1;
  const [left, setLeft] = useState(max);
  useEffect(() => setLeft(max), [max]);
  const STATE = { open: t.stateOpen, offered: t.stateOffered, taken: t.stateTaken };

  const give = async (e: React.FormEvent) => {
    e.preventDefault();
    const codes = text
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await call('/codes', { product, codes, uses: Math.min(left, max) });
    if (res) track('give_codes', { product, count: codes.length });
    if (res) {
      setText('');
      setThanks(t.given(Number(res.added) || codes.length));
    }
  };

  return (
    <section className="card">
      <h2>{t.giveTitle}</h2>
      {me.blocked ? (
        <p className="small bad">{t.blocked}</p>
      ) : (
        <form onSubmit={give} className="stack">
          <p className="small muted">{t.giveHint}</p>
          <div className="field">
            <span className="small muted" id="give-brand">{t.giveProduct}</span>
            <BrandPicker products={products} value={product} onChange={setProduct} name={name} labelledBy="give-brand" />
          </div>
          {(() => {
            const hosts = products.find((p) => p.id === product)?.hosts ?? [];
            return hosts.length > 0 && <p className="small muted">{t.giveHosts(hosts.join(', '))}</p>;
          })()}
          {max > 1 && (
            <div className="field">
              <span className="small muted" id="give-left">{t.giveLeft(max)}</span>
              <Steps max={max} value={left} onChange={setLeft} labelledBy="give-left" />
              <span className="small muted">{t.giveUses(left)}</span>
            </div>
          )}
          {me.newGiver && <p className="small muted">{t.giveNewGiver}</p>}
          <label>
            <span className="small muted">{t.giveCodes}</span>
            <textarea rows={3} value={text} onChange={(e) => (setText(e.target.value), setThanks(''))} spellCheck={false} autoComplete="off" />
          </label>
          <p className="actions">
            <button className="primary" disabled={!text.trim()}>
              {t.give}
            </button>
            {thanks && <span className="small ok">{thanks}</span>}
          </p>
        </form>
      )}
      {me.given.length > 0 && (
        <>
          <h3 className="small muted">{t.yourGiven}</h3>
          <ul className="list">
            {me.given.map((c) => (
              <li key={c.id} className="row between small">
                <span>
                  {name(c.product)} · {STATE[c.state]}
                  {(c.uses ?? 1) > 1 && ` · ${t.givenTaken((c.offered ?? 0) + (c.taken ?? 0), c.taken ?? 0, c.uses ?? 1)}`}
                  {c.report && ` · ${c.report === 'ok' ? t.reportOk : t.reportBad}`}
                </span>
                {c.state === 'open' && (
                  <button className="link" onClick={() => call('/codes/withdraw', { id: c.id })}>
                    {t.withdraw}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Chat({ messages, me, call }: { messages: Message[]; me: Me | null; call: Call }) {
  const t = useT();
  const [text, setText] = useState('');
  const [reported, setReported] = useState<number[]>([]);
  const box = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);

  useEffect(() => {
    const el = box.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await call('/chat', { text });
    if (res) setText('');
  };

  return (
    <section className="card chat">
      <h2>{t.chatTitle}</h2>
      <ol
        className="messages"
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.length === 0 && <li className="muted small">{t.chatEmpty}</li>}
        {messages.map((m) => (
          <li key={m.id} className={m.uid === me?.uid ? 'mine' : ''}>
            <span className="who" style={{ color: color(m.uid) }}>
              {m.name}
              {m.uid === me?.uid && <span className="muted"> ({t.you})</span>}
            </span>
            <span className="text">{m.text}</span>
            {me && m.uid !== me.uid && (
              <span className="tools">
                {me.admin ? (
                  <>
                    <button className="icon" title={t.remove} aria-label={t.remove} onClick={() => call('/admin/chat/delete', { id: m.id })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                      </svg>
                    </button>
                    <button className="icon" title={t.ban} aria-label={t.ban} onClick={() => call('/admin/ban', { uid: m.uid })}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="m5.6 5.6 12.8 12.8" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <button
                    className="icon"
                    title={t.report}
                    aria-label={t.report}
                    disabled={reported.includes(m.id)}
                    onClick={() => call('/chat/report', { id: m.id }).then((r) => r && setReported((x) => [...x, m.id]))}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M4 22V4M4 4h12l-2 4 2 4H4" />
                    </svg>
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ol>
      {me ? (
        <form onSubmit={send} className="row">
          <label className="grow">
            <span className="sr-only">{t.chatPlaceholder}</span>
            <input value={text} maxLength={300} placeholder={t.chatPlaceholder} onChange={(e) => setText(e.target.value)} />
          </label>
          <button className="primary" disabled={!text.trim()}>
            {t.send}
          </button>
        </form>
      ) : (
        <p className="small muted">{t.chatSignIn}</p>
      )}
    </section>
  );
}

function color(uid: string) {
  let h = 0;
  for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

function ProductIcon({ product, size }: { product: Product; size: number }) {
  const src = iconUrl(product.icon);
  return src ? (
    <img className="product-icon" src={src} alt="" width={size} height={size} />
  ) : (
    <span className="product-icon product-dot" style={{ width: size, height: size }} aria-hidden="true" />
  );
}

/** The brand list as a button and a menu with each brand's icon (no native select). */
function BrandPicker({ products, value, onChange, name, labelledBy }: { products: Product[]; value: string; onChange: (id: string) => void; name: (id: string) => string; labelledBy: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const current = products.find((p) => p.id === value);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    box.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const move = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(box.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[Math.max(0, Math.min(items.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };
  return (
    <div className={'picker' + (open ? ' open' : '')} ref={box}>
      <button type="button" className="picker-button" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={labelledBy} onClick={() => setOpen((o) => !o)}>
        {current ? <ProductName product={current} name={name} /> : <span />}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="picker-list" role="listbox" aria-labelledby={labelledBy} onKeyDown={move}>
          {products.map((p) => (
            <li
              key={p.id}
              role="option"
              tabIndex={-1}
              aria-selected={p.id === value}
              onClick={() => (onChange(p.id), setOpen(false))}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onChange(p.id), setOpen(false))}
            >
              <ProductName product={p} name={name} />
              <span className="small muted">
                {p.open} {t.colCodes}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** An on/off switch with its label (no native checkbox). */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch-row" onClick={() => onChange(!checked)}>
      <span className="switch" aria-hidden="true">
        <span className="switch-knob" />
      </span>
      <span className="small">{label}</span>
    </button>
  );
}

/** A number from 1 to max as a row of buttons (no native select). */
function Steps({ max, value, onChange, labelledBy }: { max: number; value: number; onChange: (n: number) => void; labelledBy: string }) {
  return (
    <div className="steps" role="radiogroup" aria-labelledby={labelledBy}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={n === value} className={n === value ? 'on' : ''} onClick={() => onChange(n)}>
          {n}
        </button>
      ))}
    </div>
  );
}

function ProductName({ product, name }: { product: Product; name: (id: string) => string }) {
  return (
    <span className="product-name">
      <ProductIcon product={product} size={20} />
      <span>{name(product.id)}</span>
    </span>
  );
}

type Turnstile = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
};

let turnstileScript: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  turnstileScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => {
      const ts = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (ts) resolve(ts);
      else reject(new Error('turnstile'));
    };
    s.onerror = () => {
      turnstileScript = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return turnstileScript;
}

// Cloudflare Turnstile before an email code goes out. It shows itself only
// when Cloudflare wants the person to click; the token is good for one send.
function useTurnstile(siteKey: string, lang: string) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<{ ts: Turnstile; id: string } | null>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!siteKey) return;
    let gone = false;
    loadTurnstile().then(
      (ts) => {
        if (gone || !ref.current) return;
        const id = ts.render(ref.current, {
          sitekey: siteKey,
          language: lang.toLowerCase(),
          appearance: 'interaction-only',
          callback: (t: string) => setToken(t),
          'expired-callback': () => setToken(''),
          'error-callback': () => setToken(''),
        });
        widget.current = { ts, id };
      },
      () => {},
    );
    return () => {
      gone = true;
      if (widget.current) widget.current.ts.remove(widget.current.id);
      widget.current = null;
      setToken('');
    };
  }, [siteKey, lang]);

  const reset = useCallback(() => {
    setToken('');
    if (widget.current) widget.current.ts.reset(widget.current.id);
  }, []);

  return { ref, token, reset, on: Boolean(siteKey) };
}

export type View = 'home' | 'get' | 'give' | 'vendor';
