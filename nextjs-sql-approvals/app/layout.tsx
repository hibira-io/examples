import type { Metadata, Viewport } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';

// The hosted demo at demos.hibira.io/examples/nextjs-sql-approvals/ gets a share card.
const SITE = process.env.NEXT_PUBLIC_DEMO_API ? 'https://demos.hibira.io/examples/nextjs-sql-approvals/' : undefined;
const TITLE = 'Supervisor approval for database changes · Hibira example';
const DESCRIPTION =
  'Reads run at once; a change waits until a supervisor approves its exact SQL and estimated rows on their phone. Built with Next.js and Hibira.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...(SITE && {
    metadataBase: new URL(SITE),
    openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: 'Hibira', type: 'website', images: [{ url: 'og.png', width: 1200, height: 630, alt: TITLE }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['og.png'] },
  }),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

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
