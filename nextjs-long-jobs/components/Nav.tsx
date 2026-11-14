'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from './Providers';

export function Nav() {
  const { lang, t } = useT();
  const path = usePathname();
  const q = `?lang=${lang}`;
  return (
    <nav className="nav">
      <Link href={'/blocking' + q} className={path === '/blocking' ? 'on' : ''}>
        {t.oldWay}
      </Link>
      <Link href={'/' + q} className={path === '/' ? 'on' : ''}>
        {t.newWay}
      </Link>
    </nav>
  );
}
