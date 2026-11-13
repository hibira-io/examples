'use client';

import { useEffect } from 'react';

// Makes the hosted page an installable app (public/manifest.webmanifest):
// the service worker (public/sw.js) keeps the page's shell for a fast,
// offline start, scoped to this page's path only.
export default function Pwa() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      /* private mode or blocked: the page works the same without it */
    });
  }, []);
  return null;
}
