import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

export async function isPro(plan: string): boolean {
  return plan === 'pro' || plan === 'pro-plus';
}

export async function isProPlus(plan: string): boolean {
  return plan === 'pro-plus';
}

export function getMaxAccounts(plan: string): number {
  const map: Record<string, number> = {
    free: 1,
    pro: 3,
    'pro-plus': 15,
  };
  return map[plan] ?? 1;
}
