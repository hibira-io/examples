'use client';

import DemoGate from '@/components/DemoGate';
import { DrawGame } from '@/components/RoomGames';

export default function DemoPage() {
  return <DemoGate>{(config) => <DrawGame config={config} />}</DemoGate>;
}
