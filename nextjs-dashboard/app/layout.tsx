import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Live sales dashboard · Hibira example',
  description: 'A realtime dashboard built with Next.js and Hibira.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
