import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';

// The hosted demo at demos.hibira.io/examples/nextjs-handoff/ gets a share card.
const SITE = process.env.NEXT_PUBLIC_DEMO_API ? 'https://demos.hibira.io/examples/nextjs-handoff/' : undefined;
const TITLE = 'Phone to desktop handoff · Hibira example';
const DESCRIPTION =
  'Scan a QR code, take a photo on your phone, and it lands in the form on your computer, end-to-end encrypted. Built with Next.js and Hibira.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...(SITE && {
    metadataBase: new URL(SITE),
    openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: 'Hibira', type: 'website', images: [{ url: 'og.png', width: 1200, height: 630, alt: TITLE }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['og.png'] },
  }),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

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
