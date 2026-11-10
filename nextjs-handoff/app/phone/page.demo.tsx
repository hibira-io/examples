'use client';

import Boot from '@/components/Boot';
import Phone from '@/components/Phone';

export default function DemoPage() {
  return <Boot render={(c) => <Phone {...c} />} />;
}
