import type { Metadata } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'Invite code queue · Hibira example',
  description: 'Give spare invite codes, line up for one, and chat while you wait: a live queue built with Next.js and Hibira.',
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
