'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// On hibira.io a language's page sits under the site's language prefix
// (/ja/tools/invite-queue/). The build's links don't carry it, so after
// each move inside the page (Queue, Share, …) this puts the prefix back in
// the address: a reload, a shared link and an installed app all stay in
// that language and inside the app's scope.
const PREFIX = /^\/(zh-tw|zh-cn|ja|ko|th|vi)(?=\/tools\/)/;
let prefix: string | null = null;

export default function LangPrefix() {
  const pathname = usePathname();
  useEffect(() => {
    if (prefix === null) prefix = window.location.pathname.match(PREFIX)?.[0] ?? '';
    const { pathname: path, search, hash } = window.location;
    if (prefix && !path.startsWith(`${prefix}/`)) window.history.replaceState(window.history.state, '', `${prefix}${path}${search}${hash}`);
  }, [pathname]);
  return null;
}
