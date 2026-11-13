'use client';

import { useEffect, useState } from 'react';
import { FAQ } from '@/lib/faq';
import { LANG_EVENT, detectLang, type Lang } from '@/lib/i18n';

// Rendered in the static HTML (in zh-TW) so search engines and AI answer
// engines can read it; the browser then shows the visitor's language.
export default function Faq() {
  const [lang, setLang] = useState<Lang>('zh-TW');
  useEffect(() => {
    setLang(detectLang());
    const follow = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener(LANG_EVENT, follow);
    return () => window.removeEventListener(LANG_EVENT, follow);
  }, []);
  const faq = FAQ[lang];
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
    </section>
  );
}
