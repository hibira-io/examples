'use client';

import { DEMO_API, HIBIRA_URL, SOURCE_URL } from '@/lib/demo';
import { LangMenu, useT } from './I18n';
import ShareLink from './ShareLink';

// Hibira's ripple mark (hibira.io/portal/brand/favicon.svg), drawn inline so
// it follows the theme's accent color.
function HibiraMark() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="16" cy="16" r="2.6" fill="currentColor" stroke="none" />
      <path d="M16 22a6 6 0 0 1 0-12" />
      <path d="M16 26a10 10 0 0 1 0-20" />
      <path d="M16 30.2a14.2 14.2 0 0 1 0-28.4" />
      <path d="M19.86 11.4a6 6 0 0 1 0 9.2" />
      <path d="M22.43 8.34a10 10 0 0 1 0 15.32" />
      <path d="M25.13 5.12a14.2 14.2 0 0 1 0 21.76" />
    </svg>
  );
}

export default function TopBar() {
  const t = useT();
  return (
    <nav className="topbar">
      {DEMO_API ? (
        <a className="brand" href={HIBIRA_URL} title={t.liveDemo}>
          <HibiraMark />
          <span>Hibira</span>
          <span className="brand-tag">{t.demoTag}</span>
        </a>
      ) : (
        <span />
      )}
      <span className="topbar-links">
        {DEMO_API && <a href={SOURCE_URL}>{t.source}</a>}
        {DEMO_API && <ShareLink campaign="lobby" />}
        <LangMenu />
      </span>
    </nav>
  );
}
