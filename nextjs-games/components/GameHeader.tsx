'use client';

import Link from 'next/link';
import { useT } from './I18n';

/** A game's title, with the way back to the list of games. */
export default function GameHeader({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  const t = useT();
  return (
    <header className="head">
      <div>
        <Link href="/" className="back">
          ← {t.allGames}
        </Link>
        <h1>{title}</h1>
        {intro && <p className="muted">{intro}</p>}
      </div>
      {children}
    </header>
  );
}
