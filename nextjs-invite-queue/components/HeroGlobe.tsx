'use client';

// Optional 3D hero (heroGlobe/scene.ts, three.js), as on hibira.io's home
// page. The ring art in the stylesheet is always there first and stays the
// fallback; the globe only fades in over it when all of these hold:
//
// - it is not switched off: ?hero=flat turns it off for that visit
// - a desktop-width window (phones keep the light picture)
// - no reduced-motion, Save-Data or low-memory signal
// - hardware WebGL (no software rendering)
//
// three.js is a separate chunk loaded once the page has finished loading and
// the browser is idle, so it never competes with the first paint or LCP.

import { useEffect, useRef } from 'react';

const WIDE = '(min-width: 861px)';
const CALM = '(prefers-reduced-motion: reduce)';

interface NavigatorHints {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

function wanted(): boolean {
  const q = new URLSearchParams(window.location.search).get('hero');
  if (q === 'flat') return false;
  if (!window.matchMedia(WIDE).matches || window.matchMedia(CALM).matches) return false;
  const nav = navigator as Navigator & NavigatorHints;
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  return typeof IntersectionObserver !== 'undefined' && typeof ResizeObserver !== 'undefined';
}

function whenIdle(fn: () => void): () => void {
  let cancel = () => {};
  const idle = () => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(fn, { timeout: 2500 });
      cancel = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(fn, 1200);
      cancel = () => window.clearTimeout(id);
    }
  };
  if (document.readyState === 'complete') idle();
  else {
    window.addEventListener('load', idle, { once: true });
    cancel = () => window.removeEventListener('load', idle);
  }
  return () => cancel();
}

export default function HeroGlobe() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const hero = canvas?.closest('.hero');
    if (!canvas || !hero || !wanted()) return;
    let stopped = false;
    let globe: { dispose(): void } | null = null;
    const off = () => {
      hero.classList.remove('globe-ready');
      globe?.dispose();
      globe = null;
    };
    // Shrinking the window to phone width or turning on reduced motion
    // while the page is open puts the picture back.
    const wide = window.matchMedia(WIDE);
    const calm = window.matchMedia(CALM);
    const recheck = () => {
      if (!wide.matches || calm.matches) off();
    };
    wide.addEventListener('change', recheck);
    calm.addEventListener('change', recheck);
    const cancelIdle = whenIdle(() => {
      import('./heroGlobe/scene')
        .then(({ startGlobe }) => {
          if (stopped || !wide.matches || calm.matches) return;
          globe = startGlobe(canvas, hero, {
            onReady: () => hero.classList.add('globe-ready'),
            onLost: () => {
              globe = null;
              hero.classList.remove('globe-ready');
            },
          });
        })
        // A chunk that fails to load (deploy in between, flaky network)
        // just leaves the picture.
        .catch(() => undefined);
    });
    return () => {
      stopped = true;
      cancelIdle();
      wide.removeEventListener('change', recheck);
      calm.removeEventListener('change', recheck);
      off();
    };
  }, []);
  return <canvas ref={ref} className="hero-globe" aria-hidden="true" />;
}
