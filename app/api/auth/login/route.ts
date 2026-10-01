import { NextResponse } from 'next/server';
import { safeRegisterBody, validationError } from '@/lib/validations';
import { createDemoUser, createPasswordHash, createSessionPayload, setSessionCookie, verifyPassword } from '@/lib/auth';

const demoUsers = new Map<string, { password: string; user: ReturnType<typeof createDemoUser> }>();

export async function POST(request: Request) {
  const rawBody = await request.json();
  const validated = await safeRegisterBody(rawBody);

  if (!validated.ok) {
    return validationError(validated.error);
  }

  const { email, password, name } = validated.data;
  const existing = demoUsers.get(email.toLowerCase());

  if (existing) {
    return NextResponse.json({ ok: false, error: 'User already exists' }, { status: 409 });
  }

  const user = createDemoUser(email, 'user');
  const hashedPassword = await createPasswordHash(password);
  demoUsers.set(user.email.toLowerCase(), { password: hashedPassword, user });

  const session = createSessionPayload({
    id: user.id,
    email: user.email,
    name: name ?? user.name,
    role: user.role,
  });

  await setSessionCookie(session);

  return NextResponse.json({
    ok: true,
    message: 'Account created successfully',
    user: { id: user.id, email: user.email, name: name ?? user.name, role: user.role },
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, users: Array.from(demoUsers.values()).map(({ user }) => user) });
}
