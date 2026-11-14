'use client';

import { useEffect, useRef, useState } from 'react';

// A quick share link for the hosted page: one icon in the top bar that opens
// a small menu to copy the page's address or post it to X, Facebook, LINE or
// Threads (or the device's share sheet, where there is one). Each address
// carries UTM tags, so shares show up by channel in analytics.

type Labels = { share: string; copy: string; copied: string; more: string };

const LABELS: Record<string, Labels> = {
  en: { share: 'Share this page', copy: 'Copy link', copied: 'Link copied', more: 'More…' },
  'zh-TW': { share: '分享這個頁面', copy: '複製連結', copied: '已複製連結', more: '更多…' },
  'zh-CN': { share: '分享这个页面', copy: '复制链接', copied: '已复制链接', more: '更多…' },
  ja: { share: 'このページを共有', copy: 'リンクをコピー', copied: 'リンクをコピーしました', more: 'その他…' },
  ko: { share: '이 페이지 공유', copy: '링크 복사', copied: '링크를 복사했어요', more: '더 보기…' },
  th: { share: 'แชร์หน้านี้', copy: 'คัดลอกลิงก์', copied: 'คัดลอกลิงก์แล้ว', more: 'เพิ่มเติม…' },
  vi: { share: 'Chia sẻ trang này', copy: 'Sao chép liên kết', copied: 'Đã sao chép liên kết', more: 'Thêm…' },
};

/** The page's address with UTM tags for one channel. */
function shareUrl(source: string, campaign: string) {
  const u = new URL(window.location.href);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_') || k === 'lang') u.searchParams.delete(k);
  u.hash = '';
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'share');
  u.searchParams.set('utm_campaign', campaign);
  return u.toString();
}

const TARGETS: { id: string; name: string; href: (url: string, text: string) => string }[] = [
  { id: 'x', name: 'X', href: (url, text) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
  { id: 'facebook', name: 'Facebook', href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
  { id: 'line', name: 'LINE', href: (url) => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}` },
  { id: 'threads', name: 'Threads', href: (url, text) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}` },
];

export default function ShareLink({ campaign }: { campaign: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lang, setLang] = useState('en');
  const [native, setNative] = useState(false);
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const read = () => setLang(document.documentElement.lang || 'en');
    read();
    setNative(typeof navigator.share === 'function');
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const t = LABELS[lang] ?? LABELS.en;
  const title = () => document.title.split(' | ')[0];

  const copy = async () => {
    const url = shareUrl('copy', campaign);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const area = document.createElement('textarea');
      area.value = url;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const more = async () => {
    setOpen(false);
    await navigator.share({ title: title(), url: shareUrl('native', campaign) }).catch(() => {});
  };

  return (
    <span className={'share-link' + (open ? ' open' : '')} ref={box}>
      <button type="button" className="share-button" aria-label={t.share} title={t.share} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </button>
      {open && (
        <span className="share-menu" role="menu">
          <button type="button" role="menuitem" onClick={copy}>
            {copied ? t.copied : t.copy}
          </button>
          {TARGETS.map((x) => (
            <a key={x.id} role="menuitem" href={x.href(shareUrl(x.id, campaign), title())} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
              {x.name}
            </a>
          ))}
          {native && (
            <button type="button" role="menuitem" onClick={more}>
              {t.more}
            </button>
          )}
        </span>
      )}
    </span>
  );
}
