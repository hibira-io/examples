import type { Metadata } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';

// The hosted demo at demos.hibira.io/examples/nextjs-auction/ gets a share card.
const SITE = process.env.NEXT_PUBLIC_DEMO_API ? 'https://demos.hibira.io/examples/nextjs-auction/' : undefined;
const TITLE = 'Auction house · Hibira example';
const DESCRIPTION =
  'A realtime game auction house built with Next.js, @hibira-io/auction and Hibira.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...(SITE && {
    metadataBase: new URL(SITE),
    openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: 'Hibira', type: 'website', images: [{ url: 'og.png', width: 1200, height: 630, alt: TITLE }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['og.png'] },
  }),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18n>
          <TopBar />
          {children}
        </I18n>
      </body>
    </html>
  );
}
