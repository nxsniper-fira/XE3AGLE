import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionCookie } from '@/lib/auth';

export async function GET() {
  const session = await getSessionCookie();

  if (!session) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  return NextResponse.json({ ok: true, user: session.user });
}
