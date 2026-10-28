'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { detectLang, LANG_NAMES, LANGS, saveLang, type Lang } from '@/lib/i18n';
import { STRINGS, type Strings } from '@/lib/strings';

const Context = createContext<{ lang: Lang; t: Strings; setLang: (lang: Lang) => void } | null>(null);

/** The interface strings in the visitor's language. */
export function useT(): Strings {
  return useContext(Context)!.t;
}

export function useLang(): Lang {
  return useContext(Context)!.lang;
}

// The language is only known in the browser, so nothing renders before it
// is picked (no flash of English).
export function I18n({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang | null>(null);

  useEffect(() => setLang(detectLang()), []);
  useEffect(() => {
    if (lang) document.documentElement.lang = lang;
  }, [lang]);

  if (!lang) return null;
  const choose = (next: Lang) => {
    saveLang(next);
    setLang(next);
  };
  return <Context.Provider value={{ lang, t: STRINGS[lang], setLang: choose }}>{children}</Context.Provider>;
}

export function LangMenu() {
  const { lang, t, setLang } = useContext(Context)!;
  return (
    <select aria-label={t.language} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
      {LANGS.map((l) => (
        <option key={l} value={l}>
          {LANG_NAMES[l]}
        </option>
      ))}
    </select>
  );
}
