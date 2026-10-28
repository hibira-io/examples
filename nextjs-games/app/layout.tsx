import type { Metadata } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';

export const metadata: Metadata = {
  title: 'Party games · Hibira example',
  description: 'A shared pixel canvas, draw & guess and Connect Four, built with Next.js and Hibira client events.',
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
