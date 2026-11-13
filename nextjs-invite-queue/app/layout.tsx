import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';
import Analytics from '@/components/Analytics';
import LiveChat from '@/components/LiveChat';
import Pwa from '@/components/Pwa';
import Faq from '@/components/Faq';
import { FAQ } from '@/lib/faq';

// The hosted copy is the one hibira.io serves at /tools/invite-queue/
// (DEMO_BASE_PATH); another base path is named on demos.hibira.io.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const SITE = BASE.startsWith('/tools/') ? `https://hibira.io${BASE}/` : BASE ? `https://demos.hibira.io${BASE}/` : undefined;
const TITLE = '排隊領邀請碼 · Invite code queue';
const DESCRIPTION =
  '有多的邀請碼就送人，需要就來排隊：Claude Code、Sora、Lovable、Windsurf、Replit、Kling、Suno、ElevenLabs 等 17 種工具的邀請碼與推薦碼。Give spare invite codes, line up for one and chat while you wait.';

export const metadata: Metadata = {
  title: SITE ? `${TITLE} | Hibira` : 'Invite code queue · Hibira example',
  description: SITE ? DESCRIPTION : 'Give spare invite codes, line up for one, and chat while you wait: a live queue built with Next.js and Hibira.',
  ...(SITE && {
    metadataBase: new URL(SITE),
    openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: 'Hibira', type: 'website', images: [{ url: 'og.png', width: 1200, height: 630, alt: TITLE }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['og.png'] },
    // Installable: "Add to Home Screen" opens it full screen, like an app.
    manifest: `${BASE}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: '邀請碼排隊', statusBarStyle: 'default' },
  }),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f10' },
  ],
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
          {SITE && <LiveChat />}
        </I18n>
        <Faq />
        {SITE && <Pwa />}
        {JSON_LD && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, '\\u003c') }} />}
      </body>
    </html>
  );
}
