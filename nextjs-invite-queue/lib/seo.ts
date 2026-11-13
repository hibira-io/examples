import type { Metadata } from 'next';
import type { Lang } from './i18n';
import { pageUrl } from './site';

// What link previews and search engines show for the hosted copy, one set
// per language. The first page is English; on hibira.io each other language
// is under the site's language prefix (/ja/tools/invite-queue/, lib/site.ts)
// with its own title, description and share image, so a link posted in one
// language previews in that language. The interface follows the path too
// (lib/i18n.ts).

export const LANG_SLUGS: Record<Lang, string> = {
  en: 'en',
  'zh-TW': 'zh-tw',
  'zh-CN': 'zh-cn',
  ja: 'ja',
  ko: 'ko',
  th: 'th',
  vi: 'vi',
};

const OG_LOCALES: Record<Lang, string> = { en: 'en_US', 'zh-TW': 'zh_TW', 'zh-CN': 'zh_CN', ja: 'ja_JP', ko: 'ko_KR', th: 'th_TH', vi: 'vi_VN' };

const TOOLS = 'Claude Code, Sora, Lovable, Windsurf, Replit, Kling, Suno, ElevenLabs';

export const SEO: Record<Lang, { title: string; description: string }> = {
  en: {
    title: 'Invite code queue',
    description: `Have spare invite codes? Give them away. Need one? Get in line, and codes go out in turn. Invite and referral codes for 17 tools: ${TOOLS} and more.`,
  },
  'zh-TW': {
    title: '排隊領邀請碼',
    description: `有多的邀請碼就送人，需要就來排隊，邀請碼依序發出。支援 17 種工具的邀請碼與推薦碼：${TOOLS} 等。`,
  },
  'zh-CN': {
    title: '排队领邀请码',
    description: `有多余的邀请码就送人，需要就来排队，邀请码按顺序发出。支持 17 种工具的邀请码和推荐码：${TOOLS} 等。`,
  },
  ja: {
    title: '招待コード待ち行列',
    description: `余った招待コードは譲って、欲しい人は列に並ぶだけ。コードは順番に届きます。${TOOLS} など 17 ツールの招待コードと紹介コードに対応。`,
  },
  ko: {
    title: '초대 코드 대기열',
    description: `남는 초대 코드는 나눠 주고, 필요하면 줄을 서세요. 코드는 순서대로 전달됩니다. ${TOOLS} 등 17개 도구의 초대 코드와 추천 코드를 지원합니다.`,
  },
  th: {
    title: 'คิวรับโค้ดเชิญ',
    description: `มีโค้ดเชิญเหลือก็แบ่งปัน อยากได้ก็มาต่อคิว โค้ดจะส่งให้ตามลำดับ รองรับโค้ดเชิญและโค้ดแนะนำของ 17 เครื่องมือ เช่น ${TOOLS}`,
  },
  vi: {
    title: 'Hàng chờ nhận mã mời',
    description: `Có mã mời dư thì tặng, cần thì xếp hàng, mã được gửi lần lượt. Hỗ trợ mã mời và mã giới thiệu của 17 công cụ: ${TOOLS} và nhiều hơn nữa.`,
  },
};

/** The path slug of the first page in a language: '' for English, 'ja' for Japanese. */
export function langPath(lang: Lang): string {
  return lang === 'en' ? '' : LANG_SLUGS[lang];
}

/** The first page's metadata in one language, for the hosted copy at `site`. */
export function homeMetadata(lang: Lang, site: string): Metadata {
  const { title, description } = SEO[lang];
  const url = pageUrl(langPath(lang)) ?? site;
  const image = { url: `${site}og-${LANG_SLUGS[lang]}.png`, width: 1200, height: 630, alt: title };
  const languages: Record<string, string> = Object.fromEntries(
    (Object.keys(LANG_SLUGS) as Lang[]).map((l) => [l, pageUrl(langPath(l)) ?? site]),
  );
  languages['x-default'] = site;
  return {
    title: `${title} | Hibira`,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, url, siteName: 'Hibira', type: 'website', locale: OG_LOCALES[lang], images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}
