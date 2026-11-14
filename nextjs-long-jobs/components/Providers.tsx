'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { HibiraProvider } from '@hibira-io/react';
import { type Lang, type Strings, STRINGS, toLang } from '@/lib/strings';

const host = process.env.NEXT_PUBLIC_HIBIRA_HOST || 'ws.hibira.io';
const port = Number(process.env.NEXT_PUBLIC_HIBIRA_PORT || 443);
const tls = (process.env.NEXT_PUBLIC_HIBIRA_SCHEME || 'https') === 'https';

const options = {
  wsHost: host,
  wsPort: port,
  wssPort: port,
  forceTLS: tls,
  channelAuthorization: { endpoint: '/api/hibira/auth', transport: 'ajax' as const },
};

const LangContext = createContext<{ lang: Lang; t: Strings }>({ lang: 'en', t: STRINGS.en });

/** The page's language (?lang= or the browser's) and its strings. */
export const useT = () => useContext(LangContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    const l = toLang(new URLSearchParams(location.search).get('lang')) ?? toLang(navigator.language) ?? 'en';
    setLang(l);
    document.documentElement.lang = l;
  }, []);
  return (
    <HibiraProvider appKey={process.env.NEXT_PUBLIC_HIBIRA_APP_KEY} options={options}>
      <LangContext.Provider value={{ lang, t: STRINGS[lang] }}>{children}</LangContext.Provider>
    </HibiraProvider>
  );
}
