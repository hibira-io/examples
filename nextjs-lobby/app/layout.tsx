import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reaction rooms · Hibira example',
  description: 'A multiplayer lobby and reaction game built with Next.js, Hibira and @hibira-io/lobby.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
