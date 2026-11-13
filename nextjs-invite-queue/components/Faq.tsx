'use client';

import { useEffect, useState } from 'react';
import { FAQ } from '@/lib/faq';
import { CONSENT_TEXT } from '@/lib/consent';
import { GA_ID, OPEN_CONSENT } from './Analytics';
import { LANG_EVENT, detectLang, type Lang } from '@/lib/i18n';

// Rendered in the static HTML (in English) so search engines and AI answer
// engines can read it; the browser then shows the visitor's language.
export default function Faq() {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    setLang(detectLang());
    const follow = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener(LANG_EVENT, follow);
    return () => window.removeEventListener(LANG_EVENT, follow);
  }, []);
  const faq = FAQ[lang];
  const c = CONSENT_TEXT[lang];
  // US visitors opt out (hibira.io's footer says "Your privacy choices" there).
  const [optOut, setOptOut] = useState(false);
  useEffect(() => {
    try {
      setOptOut(sessionStorage.getItem('portal.consent-mode') === 'opt_out');
    } catch {}
  }, []);
  return (
    <section className="faq" lang={lang}>
      <h2>{faq.title}</h2>
      <p className="muted">{faq.intro}</p>
      {faq.items.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
      <p className="site-foot muted">
        <a href="https://hibira.io/legal/privacy">{c.privacy}</a>
        {GA_ID && (
          <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT))}>
            {optOut ? c.choices : c.settings}
          </button>
        )}
      </p>
    </section>
  );
}
