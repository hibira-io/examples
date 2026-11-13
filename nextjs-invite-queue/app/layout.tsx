import type { Metadata } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';
import Analytics from '@/components/Analytics';
import Faq from '@/components/Faq';
import { FAQ } from '@/lib/faq';

// The hosted copies: demos.hibira.io/examples/invite-queue/ and the one
// hibira.io serves at /tools/invite-queue/ (DEMO_BASE_PATH picks which).
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const SITE = BASE.startsWith('/tools/') ? `https://hibira.io${BASE}/` : BASE ? `https://demos.hibira.io${BASE}/` : undefined;
const TITLE = '排隊領邀請碼 · Invite code queue';
const DESCRIPTION =
  '有多的邀請碼就送人，需要就來排隊：Claude Code、Sora、Manus、Perplexity、Cursor、Genspark、Lovable 邀請碼。Give spare invite codes, line up for one and chat while you wait.';

export const metadata: Metadata = {
  title: SITE ? `${TITLE} | Hibira` : 'Invite code queue · Hibira example',
  description: SITE ? DESCRIPTION : 'Give spare invite codes, line up for one, and chat while you wait: a live queue built with Next.js and Hibira.',
  ...(SITE && {
    metadataBase: new URL(SITE),
    openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: 'Hibira', type: 'website', images: [{ url: 'og.png', width: 1200, height: 630, alt: TITLE }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['og.png'] },
  }),
};

// Structured data for search engines and AI answer engines: what the page
// is, and the questions it answers (the zh-TW text the static HTML shows).
const JSON_LD = SITE && {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: TITLE,
      url: SITE,
      description: DESCRIPTION,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      inLanguage: ['zh-TW', 'en', 'zh-CN', 'ja', 'ko', 'th', 'vi'],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: 'Hibira', url: 'https://hibira.io/' },
    },
    {
      '@type': 'FAQPage',
      inLanguage: 'zh-TW',
      mainEntity: FAQ['zh-TW'].items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE ? 'zh-TW' : 'en'}>
      <body>
        <I18n>
          <TopBar />
          {children}
          <Analytics />
        </I18n>
        <Faq />
        {JSON_LD && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />}
      </body>
    </html>
  );
}
