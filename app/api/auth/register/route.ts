import { NextResponse } from 'next/server';
import { createDemoUser, getDemoUserByEmail, saveDemoUser } from '@/lib/auth-store';
import { createPasswordHash, createSessionPayload, setSessionCookie } from '@/lib/auth';
import { safeRegisterBody } from '@/lib/validations';

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);
  const validation = await safeRegisterBody(rawBody);

  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const { email, password, name } = validation.data;
  const existing = getDemoUserByEmail(email);

  if (existing) {
    return NextResponse.json({ ok: false, error: 'User already exists' }, { status: 409 });
  }

  const user = createDemoUser(email, 'user');
  const hashedPassword = await createPasswordHash(password);

  saveDemoUser({
    id: user.id,
    email: user.email,
    name: name ?? user.name,
    role: user.role,
    passwordHash: hashedPassword,
  });

  await setSessionCookie(
    createSessionPayload({
      id: user.id,
      email: user.email,
      name: name ?? user.name,
      role: user.role,
    })
  );

  return NextResponse.json({
    ok: true,
    message: 'Account created successfully',
    user: { id: user.id, email: user.email, name: name ?? user.name, role: user.role },
  });
}
