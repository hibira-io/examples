// The languages of the demo's interface, the same seven as hibira.io. A
// language path (/en/, /ja/…) or ?lang= sets it and is remembered, so /get
// and /give stay in it; otherwise the choice in the language menu, then the
// browser's languages.

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

// The first pages under a language path (app/[lang]); zh-TW is /.
const PATH_LANGS = ['en', 'zh-cn', 'ja', 'ko', 'th', 'vi'];

export function detectLang(): Lang {
  const segment = location.pathname.split('/').filter(Boolean).pop() ?? '';
  const fromURL = toLang(PATH_LANGS.includes(segment) ? segment : new URLSearchParams(location.search).get('lang'));
  if (fromURL) {
    try {
      localStorage.setItem(KEY, fromURL);
    } catch {}
    return fromURL;
  }
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
  // Parts rendered outside the language context (the FAQ) follow the menu.
  window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: lang }));
}

export const LANG_EVENT = 'invite-queue-lang';
