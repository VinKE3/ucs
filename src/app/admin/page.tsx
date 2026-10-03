import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return <AdminDashboard session={session} />;
}
