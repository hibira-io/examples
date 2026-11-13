import QueuePage from '@/components/QueuePage';

// Read the environment on each request, so a .env.local added while the
// dev server runs takes effect after a reload.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <QueuePage view="give" />;
}
