'use client';

import { DEMO_API, HIBIRA_URL, SOURCE_URL } from '@/lib/demo';
import { LangMenu, useT } from './I18n';

export default function TopBar() {
  const t = useT();
  return (
    <nav className="topbar">
      {DEMO_API ? <a href={HIBIRA_URL}>{t.liveDemo}</a> : <span />}
      <span className="topbar-links">
        {DEMO_API && <a href={SOURCE_URL}>{t.source}</a>}
        <LangMenu />
      </span>
    </nav>
  );
}
