import type { Metadata } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'Shared trip planner · Hibira example',
  description: 'A collaborative form with live cursors, field locks and follow mode, built with Next.js, Hibira and @hibira-io/spaces.',
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
