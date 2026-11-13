import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';
import Analytics from '@/components/Analytics';
import LiveChat from '@/components/LiveChat';
import Pwa from '@/components/Pwa';
import Faq from '@/components/Faq';
import { FAQ } from '@/lib/faq';

import { BASE, SITE } from '@/lib/site';
import { SEO } from '@/lib/seo';

// The pages without their own metadata (/get, /give) are English, like /;
// the first page in other languages is /ja/tools/invite-queue/ and so on
// (app/[lang], lib/site.ts).
const { title: TITLE, description: DESCRIPTION } = SEO.en;

export const metadata: Metadata = {
  title: SITE ? `${TITLE} | Hibira` : 'Invite code queue · Hibira example',
  description: SITE ? DESCRIPTION : 'Give spare invite codes, line up for one, and chat while you wait: a live queue built with Next.js and Hibira.',
  ...(SITE && {
    metadataBase: new URL(SITE),
    openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: 'Hibira', type: 'website', images: [{ url: 'og-en.png', width: 1200, height: 630, alt: TITLE }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['og-en.png'] },
    // Installable: "Add to Home Screen" opens it full screen, like an app.
    manifest: `${BASE}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: 'Invite queue', statusBarStyle: 'default' },
  }),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f10' },
  ],
};

// Structured data for search engines and AI answer engines: what the page
// is, and the questions it answers (the English text the static HTML shows).
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
      inLanguage: 'en',
      mainEntity: FAQ.en.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
