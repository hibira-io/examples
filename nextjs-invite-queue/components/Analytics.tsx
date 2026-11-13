'use client';

import { useEffect, useState } from 'react';
import { useT } from './I18n';

// Google Analytics 4 for the hosted demo (NEXT_PUBLIC_GA_ID, set only in the
// demo build). Consent Mode v2: storage starts denied, so until the visitor
// says OK the tag sends cookieless pings only; ads are never granted.

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? '';
const KEY = 'invite-queue-analytics';

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | null {
  const w = window as unknown as { gtag?: Gtag };
  return w.gtag ?? null;
}

/** Records one event when analytics is on (sign-in, line, give, signup click). */
export function track(name: string, params: Record<string, string | number> = {}) {
  if (!GA_ID || typeof window === 'undefined') return;
  gtag()?.('event', name, params);
}

function stored(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export default function Analytics() {
  const t = useT();
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!GA_ID || !/^G-[A-Z0-9]{4,20}$/.test(GA_ID)) return;
    const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
    w.dataLayer = w.dataLayer || [];
    w.gtag = function () {
      // gtag.js reads the arguments object itself.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments);
    };
    const choice = stored();
    w.gtag('consent', 'default', {
      analytics_storage: choice === 'granted' ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    w.gtag('js', new Date());
    w.gtag('config', GA_ID);
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);
    setAsk(!choice);
  }, []);

  if (!ask) return null;
  const answer = (v: 'granted' | 'denied') => {
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    gtag()?.('consent', 'update', { analytics_storage: v });
    setAsk(false);
  };
  return (
    <div className="ga-notice" role="region" aria-label="Analytics">
      <span>{t.gaNotice}</span>
      <span className="actions">
        <button className="primary" onClick={() => answer('granted')}>
          {t.gaAccept}
        </button>
        <button className="secondary" onClick={() => answer('denied')}>
          {t.gaDecline}
        </button>
      </span>
    </div>
  );
}
