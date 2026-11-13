import type { Metadata } from 'next';
import './globals.css';
import { I18n } from '@/components/I18n';
import TopBar from '@/components/TopBar';
import Analytics from '@/components/Analytics';

// The hosted copies: demos.hibira.io/examples/invite-queue/ and the one
// hibira.io serves at /tools/invite-queue/ (DEMO_BASE_PATH picks which).
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const SITE = BASE.startsWith('/tools/') ? `https://hibira.io${BASE}/` : BASE ? `https://demos.hibira.io${BASE}/` : undefined;
const TITLE = '排隊領邀請碼 · Invite code queue';
const DESCRIPTION =
  '有多的邀請碼就送人，需要就來排隊：Claude Code 分享碼、AI 工具、App 搶先體驗、遊戲封測。Give spare invite codes, line up for one and chat while you wait.';

export const metadata: Metadata = {
  title: SITE ? `${TITLE} | Hibira` : 'Invite code queue · Hibira example',
  description: SITE ? DESCRIPTION : 'Give spare invite codes, line up for one, and chat while you wait: a live queue built with Next.js and Hibira.',
  ...(SITE && {
    metadataBase: new URL(SITE),
    openGraph: { title: TITLE, description: DESCRIPTION, url: SITE, siteName: 'Hibira', type: 'website', images: [{ url: 'og.png', width: 1200, height: 630, alt: TITLE }] },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['og.png'] },
  }),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18n>
          <TopBar />
          {children}
          <Analytics />
        </I18n>
      </body>
    </html>
  );
}
