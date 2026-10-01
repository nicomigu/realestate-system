import type { Models } from '../../prisma/contract.js';
import type { Db } from '../../prisma/db.js';

type LeadRow = Omit<Models.public_Lead, 'assignedTo'>;

export async function createAgent(db: Db, email = 'agent@example.com'): Promise<{ id: string }> {
  return db.orm.public.User.create({
    email,
    name: 'Nico Agent',
    role: 'AGENT',
    passwordHash: 'not-used-in-these-tests',
  });
}

export async function createAdmin(db: Db, email = 'admin@example.com'): Promise<{ id: string }> {
  return db.orm.public.User.create({
    email,
    name: 'Alex Admin',
    role: 'ADMIN',
    passwordHash: 'not-used-in-these-tests',
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
