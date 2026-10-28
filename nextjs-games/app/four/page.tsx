import { FourGame } from '@/components/RoomGames';
import Setup from '@/components/Setup';
import { localConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function Page() {
  const config = localConfig();
  return config ? <FourGame config={config} /> : <Setup />;
}
