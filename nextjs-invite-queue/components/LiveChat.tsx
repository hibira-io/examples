'use client';

import { useEffect } from 'react';
import { useLang } from './I18n';

// Hibira's own support chat (the Live Chat widget of the support workspace,
// the same one hibira.io shows) on the copy hibira.io serves at
// /tools/invite-queue/. The support workspace answers only on hibira.io, so
// the demos.hibira.io copy and your own runs leave it out, and "Want another
// product here?" there links to the hibira.io copy with the chat open.

const SRC = 'https://chat.hibira.io/w/v1.js';
const WORKSPACE = 'ws_hibira';
const OPEN_PARAM = 'chat';
export const ASK_URL = `https://hibira.io/tools/invite-queue/?${OPEN_PARAM}=open`;

type Widget = { open: () => void };
const widget = () => (window as unknown as { HibiraLiveChat?: Widget }).HibiraLiveChat;

/** "Want another product here?": the support chat when it is on the page. */
export function askBrand(e: React.MouseEvent) {
  const w = widget();
  if (!w) return;
  e.preventDefault();
  w.open();
}

export default function LiveChat() {
  const lang = useLang();
  useEffect(() => {
    if (location.hostname !== 'hibira.io' || document.querySelector(`script[src="${SRC}"]`)) return;
    if (new URLSearchParams(location.search).get(OPEN_PARAM) === 'open') {
      window.addEventListener('hibira-livechat:ready', () => widget()?.open(), { once: true });
    }
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.dataset.workspace = WORKSPACE;
    s.dataset.lang = lang;
    document.body.appendChild(s);
    // The widget reads its language once, when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
