import { NextResponse } from 'next/server';
import { validationError } from '@/lib/validations';
import { getDemoUserByEmail } from '@/lib/auth-store';
import { createSessionPayload, setSessionCookie, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody.email !== 'string' || typeof rawBody.password !== 'string') {
    return validationError('Email and password are required');
  }

  const email = rawBody.email.toLowerCase();
  const userRecord = getDemoUserByEmail(email);

  if (!userRecord) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await verifyPassword(rawBody.password, userRecord.passwordHash);

  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  await setSessionCookie(
    createSessionPayload({
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
    })
  );

  return NextResponse.json({
    ok: true,
    message: 'Logged in successfully',
    user: {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
    },
  });
}
