import { NextResponse } from 'next/server';
import { createSessionPayload, createDemoUser, setSessionCookie, verifyPassword } from '@/lib/auth';
import { validationError } from '@/lib/validations';

const demoUsers = new Map<string, { password: string; user: ReturnType<typeof createDemoUser> }>();

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody.email !== 'string' || typeof rawBody.password !== 'string') {
    return validationError('Email and password are required');
  }

  const email = rawBody.email.toLowerCase();
  const password = rawBody.password;
  const userRecord = demoUsers.get(email);

  if (!userRecord) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await verifyPassword(password, userRecord.password);

  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const session = createSessionPayload({
    id: userRecord.user.id,
    email: userRecord.user.email,
    name: userRecord.user.name,
    role: userRecord.user.role,
  });

  await setSessionCookie(session);

  return NextResponse.json({
    ok: true,
    message: 'Logged in successfully',
    user: {
      id: userRecord.user.id,
      email: userRecord.user.email,
      name: userRecord.user.name,
      role: userRecord.user.role,
    },
  });
}
