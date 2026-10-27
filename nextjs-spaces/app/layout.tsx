import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Shared trip planner · Hibira example',
  description: 'A collaborative form with live cursors, field locks and follow mode, built with Next.js, Hibira and @hibira-io/spaces.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
