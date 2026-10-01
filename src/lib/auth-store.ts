import { randomUUID } from 'crypto';

export type DemoUserRecord = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  passwordHash: string;
};

export const demoUsers = new Map<string, DemoUserRecord>();

export function createDemoUser(email: string, role: 'user' | 'admin' = 'user') {
  return {
    id: randomUUID(),
    email,
    name: email.split('@')[0],
    role,
  };
}

export function getDemoUserByEmail(email: string) {
  return demoUsers.get(email.toLowerCase());
}

export function saveDemoUser(user: DemoUserRecord) {
  demoUsers.set(user.email.toLowerCase(), user);
  return user;
}
