'use client';

import Canvas from '@/components/Canvas';
import DemoGate from '@/components/DemoGate';

export default function DemoPage() {
  return <DemoGate>{(config) => <Canvas config={config} />}</DemoGate>;
}
