import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ops dashboard: polling vs push · Hibira example',
  description: 'The same Postgres-backed dashboard, polled by every viewer or pushed once a second over Hibira.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
