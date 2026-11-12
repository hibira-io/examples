'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { detectLang, LANG_NAMES, LANGS, saveLang, type Lang } from '@/lib/i18n';
import { STRINGS, type Strings } from '@/lib/strings';

const Context = createContext<{ lang: Lang; t: Strings; setLang: (lang: Lang) => void } | null>(null);

/** The interface strings in the visitor's language. */
export function useT(): Strings {
  return useContext(Context)!.t;
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
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    (list.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.current?.querySelector<HTMLElement>('li'))?.focus();
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const pick = (l: Lang) => {
    setLang(l);
    setOpen(false);
    box.current?.querySelector('button')?.focus();
  };
  const onKey = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(e.currentTarget.children) as HTMLElement[];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) {
      e.preventDefault();
      pick(LANGS[i]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      box.current?.querySelector('button')?.focus();
    }
  };
  return (
    <div className={'lang-menu' + (open ? ' open' : '')} ref={box}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={t.language} onClick={() => setOpen(!open)}>
        {LANG_NAMES[lang]}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" aria-label={t.language} ref={list} onKeyDown={onKey}>
          {LANGS.map((l) => (
            <li key={l} role="option" tabIndex={-1} aria-selected={l === lang} onClick={() => pick(l)}>
              {LANG_NAMES[l]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
