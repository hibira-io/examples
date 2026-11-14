import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Long jobs, streamed · Hibira example',
  description: "Stream a long job's output to every open tab with Next.js and Hibira.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <main>
            <Nav />
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
