'use client';

import Boot from '@/components/Boot';
import Desk from '@/components/Desk';

export default function DemoPage() {
  return <Boot render={(c) => <Desk {...c} />} />;
}
