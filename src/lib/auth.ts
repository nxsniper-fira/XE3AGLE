import { cookies } from 'next/headers';
import { compare, hash } from 'bcryptjs';
import { randomUUID } from 'crypto';

export const SESSION_COOKIE_NAME = 'xe3agle_session';

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: 'user' | 'admin';
};

export async function createPasswordHash(password: string) {
  return hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return compare(password, hashedPassword);
}

export function createSessionPayload(user: SessionUser) {
  return {
    user,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };
}

export async function setSessionCookie(session: ReturnType<typeof createSessionPayload>) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!value) return null;

  try {
    return JSON.parse(value) as ReturnType<typeof createSessionPayload>;
  } catch {
    return null;
  }
}

export function createDemoUser(email: string, role: 'user' | 'admin' = 'user') {
  return {
    id: randomUUID(),
    email,
    name: email.split('@')[0],
    role,
  };
}
