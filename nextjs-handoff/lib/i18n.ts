// The languages of the demo's interface, the same seven as hibira.io. The
// first visit follows ?lang= or the browser's languages; the choice in the
// language menu is remembered in this browser.

export const LANGS = ['en', 'zh-TW', 'zh-CN', 'ja', 'ko', 'th', 'vi'] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ja: '日本語',
  ko: '한국어',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

const KEY = 'lang';

/** The closest supported language to a BCP 47 tag, or null. */
export function toLang(tag: string | null | undefined): Lang | null {
  if (!tag) return null;
  const t = tag.toLowerCase();
  const exact = LANGS.find((l) => l.toLowerCase() === t);
  if (exact) return exact;
  if (t.startsWith('zh')) {
    return /hans|cn|sg|my/.test(t) ? 'zh-CN' : 'zh-TW';
  }
  return LANGS.find((l) => l === t.split('-')[0]) ?? null;
}

export function detectLang(): Lang {
  const fromURL = toLang(new URLSearchParams(location.search).get('lang'));
  if (fromURL) return fromURL;
  try {
    const saved = toLang(localStorage.getItem(KEY));
    if (saved) return saved;
  } catch {}
  for (const tag of navigator.languages ?? [navigator.language]) {
    const lang = toLang(tag);
    if (lang) return lang;
  }
  return 'en';
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {}
}
