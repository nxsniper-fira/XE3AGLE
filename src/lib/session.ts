import { NextResponse } from 'next/server';
import { getSessionCookie } from '@/lib/auth';

export async function requireSession() {
  const session = await getSessionCookie();

  if (!session || !session.user) {
    return null;
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireSession();

  if (!session || session.user.role !== 'admin') {
    return null;
  }

  return session;
}

export function responseJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
