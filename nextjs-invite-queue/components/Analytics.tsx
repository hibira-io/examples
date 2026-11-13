'use client';

import { useEffect, useRef, useState } from 'react';
import { useLang } from './I18n';
import { CONSENT_TEXT } from '@/lib/consent';

// Google Analytics 4 for the hosted demo (NEXT_PUBLIC_GA_ID, set only in the
// demo build), with the same cookie consent as hibira.io
// (hibira-io/pusher-server web/portal/src/lib/analytics.ts): the visitor's
// region decides (GET /api/v1/consent on hibira.io). Opt-in regions (EEA,
// UK, Switzerland, mainland China, Korea, Thailand, Vietnam, or unknown)
// see Allow / No thanks over a mask before anything loads; the US gets
// analytics until they opt out, a Global Privacy Control signal counting as
// opting out; elsewhere a one-time notice with Turn off. The tag loads only
// once consent applies, never for ads, and the choice uses hibira.io's
// storage keys, so on hibira.io one answer covers the whole site.

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';
const CONSENT_KEY = 'portal.analytics-consent';
const NOTICE_KEY = 'portal.analytics-notice';
const MODE_KEY = 'portal.consent-mode';
/** The page's "Cookie settings" link (components/Faq.tsx) opens the choice again. */
export const OPEN_CONSENT = 'invite-queue:open-consent';

type Mode = 'opt_in' | 'opt_out' | 'notice';

let loaded = false;

// gtag.js reads the arguments object itself, not an array of them.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  const w = window as unknown as { dataLayer?: unknown[] };
  // eslint-disable-next-line prefer-rest-params
  (w.dataLayer ??= []).push(arguments);
}

/** Records one event when analytics is on (sign-in, line, give, signup click). */
export function track(name: string, params: Record<string, string | number> = {}) {
  if (loaded) gtag('event', name, params);
}

function get(store: 'local' | 'session', key: string): string {
  try {
    return (store === 'local' ? localStorage : sessionStorage).getItem(key) ?? '';
  } catch {
    return '';
  }
}

function set(store: 'local' | 'session', key: string, value: string) {
  try {
    (store === 'local' ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    /* private mode: asked again next visit */
  }
}

const gpc = () => (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

// Programs driving a browser (screenshots, tests) are not visitors.
const automated = () => navigator.webdriver === true || /HeadlessChrome|Lighthouse|PTST/i.test(navigator.userAgent);

/** The region's mode, from hibira.io (opt-in when it cannot be asked). */
export async function consentMode(): Promise<Mode> {
  const saved = get('session', MODE_KEY) as Mode;
  if (['opt_in', 'opt_out', 'notice'].includes(saved)) return saved;
  let mode: Mode = 'opt_in';
  try {
    const url = location.hostname === 'hibira.io' ? '/api/v1/consent' : 'https://hibira.io/api/v1/consent';
    const r = (await (await fetch(url, { credentials: 'omit' })).json()) as { mode?: string };
    if (r.mode === 'opt_out' || r.mode === 'notice' || r.mode === 'opt_in') mode = r.mode;
  } catch {
    /* offline, blocked or another origin: opt-in */
  }
  set('session', MODE_KEY, mode);
  return mode;
}

function effective(mode: Mode): 'granted' | 'denied' | null {
  const own = get('local', CONSENT_KEY);
  if (own === 'granted' || own === 'denied') return own;
  if (mode === 'opt_out' || mode === 'notice') return gpc() ? 'denied' : 'granted';
  return null;
}

function load() {
  if (loaded || automated() || !/^G-[A-Z0-9]{4,20}$/.test(GA_ID)) return;
  loaded = true;
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
  gtag('consent', 'update', { analytics_storage: 'granted' });
  gtag('js', new Date());
  gtag('config', GA_ID, { anonymize_ip: true });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

// Removes gtag's cookies (_ga, _ga_<id>) from this host and its parents.
function clearCookies() {
  const parts = location.hostname.split('.');
  const domains = [''];
  for (let i = 0; i < parts.length - 1; i++) domains.push('; domain=.' + parts.slice(i).join('.'));
  for (const c of document.cookie.split(';')) {
    const name = c.trim().split('=')[0];
    if (!/^_ga(_|$)/.test(name)) continue;
    for (const d of domains) document.cookie = name + '=; Max-Age=0; path=/' + d;
  }
}

export default function Analytics() {
  const lang = useLang();
  const t = CONSENT_TEXT[lang];
  const [ask, setAsk] = useState<'ask' | 'notice' | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GA_ID) return;
    let live = true;
    void consentMode().then((mode) => {
      if (!live) return;
      if (effective(mode) === 'granted') load();
      const own = get('local', CONSENT_KEY);
      if (own) return;
      if (mode === 'opt_in') setAsk('ask');
      else if (!gpc() && get('local', NOTICE_KEY) !== '1') setAsk('notice');
    });
    const open = () => setAsk('ask');
    window.addEventListener(OPEN_CONSENT, open);
    return () => {
      live = false;
      window.removeEventListener(OPEN_CONSENT, open);
    };
  }, []);

  // The full choice is modal: the page behind it is inert and does not scroll.
  useEffect(() => {
    if (ask !== 'ask') return;
    const others = [...document.body.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !c.contains(bar.current) && !c.inert);
    others.forEach((c) => (c.inert = true));
    document.documentElement.classList.add('consent-lock');
    bar.current?.querySelector<HTMLElement>('button.primary')?.focus({ preventScroll: true });
    return () => {
      others.forEach((c) => (c.inert = false));
      document.documentElement.classList.remove('consent-lock');
    };
  }, [ask]);

  if (!ask) return null;
  const choose = (granted: boolean) => {
    set('local', CONSENT_KEY, granted ? 'granted' : 'denied');
    setAsk(null);
    if (granted) return load();
    if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' });
    loaded = false;
    clearCookies();
  };
  const privacy = <a href="https://hibira.io/legal/privacy">{t.privacy}</a>;
  if (ask === 'notice') {
    return (
      <div ref={bar} className="consent" role="dialog" aria-live="polite" aria-label={t.title}>
        <p>
          {t.notice} {privacy}
        </p>
        <div className="consent-actions">
          <button className="secondary" onClick={() => choose(false)}>
            {t.turnOff}
          </button>
          <button
            className="primary"
            onClick={() => {
              set('local', NOTICE_KEY, '1');
              setAsk(null);
            }}
          >
            {t.ok}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div ref={bar}>
      <div className="consent-mask" aria-hidden="true" />
      <div className="consent" role="dialog" aria-modal="true" aria-live="polite" aria-label={t.title}>
        <p>
          {t.ask} {privacy}
        </p>
        <div className="consent-actions">
          <button className="secondary" onClick={() => choose(false)}>
            {t.no}
          </button>
          <button className="primary" onClick={() => choose(true)}>
            {t.allow}
          </button>
        </div>
      </div>
    </div>
  );
}
