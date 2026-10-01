import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }
  return session.user;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    redirect('/app');
  }
  return session.user;
}
