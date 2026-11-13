import type { Metadata } from 'next';
import DemoQueuePage from '@/components/DemoQueuePage';
import { LANGS, type Lang } from '@/lib/i18n';
import { homeMetadata, LANG_SLUGS } from '@/lib/seo';
import { SITE } from '@/lib/site';

// The first page in each language other than zh-TW (which is /): /en/,
// /ja/ and so on, so a shared link previews in the language it was
// posted in.
const OTHER = LANGS.filter((l) => l !== 'zh-TW');

export const dynamicParams = false;

export function generateStaticParams() {
  return OTHER.map((l) => ({ lang: LANG_SLUGS[l] }));
}

function langOf(slug: string): Lang {
  return OTHER.find((l) => LANG_SLUGS[l] === slug) ?? 'en';
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return SITE ? homeMetadata(langOf(lang), SITE) : {};
}

export default function LangPage() {
  return <DemoQueuePage view="home" />;
}
