import type { Models } from '../../prisma/contract.js';
import type { Db } from '../../prisma/db.js';
import { hashPassword } from '../../src/auth/password.js';

type LeadRow = Omit<Models.public_Lead, 'assignedTo'>;

interface UserOptions {
  email?: string;
  /** Hashing is slow on purpose, so only tests that log in should pass one. */
  password?: string;
}

export async function createAgent(db: Db, options: UserOptions = {}): Promise<{ id: string }> {
  return db.orm.public.User.create({
    email: options.email ?? 'agent@example.com',
    name: 'Nico Agent',
    role: 'AGENT',
    passwordHash: options.password ? await hashPassword(options.password) : 'no-password',
  });
}

export async function createAdmin(db: Db, options: UserOptions = {}): Promise<{ id: string }> {
  return db.orm.public.User.create({
    email: options.email ?? 'admin@example.com',
    name: 'Alex Admin',
    role: 'ADMIN',
    passwordHash: options.password ? await hashPassword(options.password) : 'no-password',
  });
}

export async function findLead(db: Db, id: string): Promise<LeadRow | null> {
  return db.orm.public.Lead.where({ id }).first();
}

export async function activityTypes(db: Db, leadId: string): Promise<string[]> {
  const events = await db.orm.public.ActivityEvent.where({ leadId })
    .orderBy((e) => e.createdAt.asc())
    .all();
  return events.map((e) => e.type);
}
