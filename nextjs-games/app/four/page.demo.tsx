'use client';

import DemoGate from '@/components/DemoGate';
import { FourGame } from '@/components/RoomGames';

export default function DemoPage() {
  return <DemoGate>{(config) => <FourGame config={config} />}</DemoGate>;
}
