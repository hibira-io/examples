'use client';

import Link from 'next/link';
import { useT } from './I18n';

export default function Home() {
  const t = useT();
  const games = [
    { href: '/canvas/', icon: '🎨', title: t.canvasTitle, text: t.canvasText },
    { href: '/draw/', icon: '✏️', title: t.drawTitle, text: t.drawText },
    { href: '/four/', icon: '🔴', title: t.fourTitle, text: t.fourText },
  ];
  return (
    <main className="page">
      <header className="head">
        <h1>{t.title}</h1>
        <p className="muted">{t.intro}</p>
      </header>
      <div className="games">
        {games.map((g) => (
          <Link key={g.href} href={g.href} className="card game-card">
            <span className="game-icon" aria-hidden>
              {g.icon}
            </span>
            <strong>{g.title}</strong>
            <span className="muted">{g.text}</span>
            <span className="game-play">{t.play} →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
