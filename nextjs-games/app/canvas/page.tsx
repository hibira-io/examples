import Canvas from '@/components/Canvas';
import Setup from '@/components/Setup';
import { localConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default function Page() {
  const config = localConfig();
  return config ? <Canvas config={config} /> : <Setup />;
}
