import type { Metadata } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'Auction house · Hibira example',
  description: 'A realtime game auction house built with Next.js, @hibira-io/auction and Hibira.',
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
