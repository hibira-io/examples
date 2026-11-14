'use client';

import { useEffect } from 'react';

// Makes the hosted page an installable app (public/manifest.webmanifest, and
// public/<lang>/manifest.webmanifest for each language): the service worker
// (public/sw.js) keeps the page's shell for a fast, offline start. On
// hibira.io a language's page sits under the site's language prefix
// (/ja/tools/invite-queue/), so the worker is registered there too, and an
// app installed from that page opens it, in its language, also offline.
const PREFIX = /^\/(zh-tw|zh-cn|ja|ko|th|vi)(?=\/tools\/)/;

export default function Pwa() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const base = (window.location.pathname.match(PREFIX)?.[0] ?? '') + (process.env.NEXT_PUBLIC_BASE_PATH ?? '');
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      /* private mode or blocked: the page works the same without it */
    });
  }, []);
  return null;
}
