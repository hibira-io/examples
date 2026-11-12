import type { Icon, Rarity } from '@/lib/items';

// Simple line icons, so the demo needs no image files.
const PATHS: Record<Icon, string> = {
  sword: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  potion: 'M10 2v7.31M14 9.3V2M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0M5.52 16h12.96',
  gem: 'M6 3h12l4 6-10 13L2 9zM11 3 8 9l4 13 4-13-3-6M2 9h20',
  bow: 'M17 3h4v4M18.58 5.42 9 15M5 12c0 4 3 7 7 7M5 12c0-4 2-7 7-9M12 19c2-5 5-7 9-7M3 21l6-6',
  ring: 'M12 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM9 3h6l-3 4z',
  helm: 'M4 14a8 8 0 0 1 16 0v4h-5v-4h-6v4H4zM12 6V3',
  scroll: 'M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4M19 17V5a2 2 0 0 0-2-2H4M14 8h-4M15 12h-5',
};

export default function ItemIcon({ icon, rarity, size = 40 }: { icon: Icon; rarity: Rarity; size?: number }) {
  return (
    <span className={`item-icon rarity-${rarity}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[icon]} />
      </svg>
    </span>
  );
}
