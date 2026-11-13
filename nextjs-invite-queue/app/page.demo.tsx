import type { Metadata } from 'next';
import DemoQueuePage from '@/components/DemoQueuePage';
import { homeMetadata } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const metadata: Metadata = SITE ? homeMetadata('en', SITE) : {};

export default function DemoPage() {
  return <DemoQueuePage view="home" />;
}
