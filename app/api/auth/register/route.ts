import { NextResponse } from 'next/server';
import { safeRegisterBody } from '@/lib/validations';
import { createDemoUser, createPasswordHash, setSessionCookie, createSessionPayload } from '@/lib/auth';

export async function POST(request: Request) {
  const rawBody = await request.json();
  const validation = await safeRegisterBody(rawBody);

  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const { email, password, name } = validation.data;
  const user = createDemoUser(email, 'user');
  const hashedPassword = await createPasswordHash(password);

  const sessionPayload = createSessionPayload({
    id: user.id,
    email: user.email,
    name: name ?? user.name,
    role: user.role,
  });

  await setSessionCookie(sessionPayload);

  return NextResponse.json({
    ok: true,
    message: 'Account created successfully',
    user: {
      id: user.id,
      email: user.email,
      name: name ?? user.name,
      role: user.role,
    },
    passwordHash: hashedPassword,
  });
}
