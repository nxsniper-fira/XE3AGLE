import { NextResponse } from 'next/server';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function validationError(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export async function safeRegisterBody(rawBody: unknown) {
  const parsed = registerSchema.safeParse(rawBody);

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid payload' };
  }

  return { ok: true as const, data: parsed.data };
}

export async function safeLoginBody(rawBody: unknown) {
  const parsed = loginSchema.safeParse(rawBody);

  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid payload' };
  }

  return { ok: true as const, data: parsed.data };
}
