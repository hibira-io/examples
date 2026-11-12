'use client';

import Boot from '@/components/Boot';
import Console from '@/components/Console';

export default function DemoPage() {
  return <Boot render={(config) => <Console config={config} />} />;
}
