// Resets the database to a demo-ready state: two users, the default follow-up
// sequence, and ~50 leads spread across sources, stages and the last 8 weeks.
// Safe to re-run (the nightly reseed uses it). Run with `pnpm db:seed`.
import { hashPassword } from '../src/auth/password.ts';
import { db } from './db.ts';

const SEED_PASSWORD = process.env['SEED_PASSWORD'] ?? 'demo1234';
const LEAD_COUNT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

type Source = 'WEBSITE' | 'FACEBOOK' | 'ZILLOW' | 'GOOGLE_ADS' | 'MANUAL';
type Stage = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'APPOINTMENT' | 'CLOSED_WON' | 'CLOSED_LOST';
type Intent = 'BUYER' | 'SELLER' | 'INVESTOR' | 'UNKNOWN';

// Deterministic PRNG so every reseed produces the same demo data.
let rngState = 42;
function rand(): number {
  rngState = (rngState * 1664525 + 1013904223) % 2 ** 32;
  return rngState / 2 ** 32;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries[entries.length - 1]![0];
}

const FIRST_NAMES = ['Ava', 'Liam', 'Maya', 'Noah', 'Sofia', 'Ethan', 'Chloe', 'Lucas', 'Isla', 'Mateo', 'Priya', 'Omar', 'Hana', 'Diego', 'Zoe', 'Kenji'];
const LAST_NAMES = ['Nguyen', 'Garcia', 'Patel', 'Kim', 'Smith', 'Rossi', 'Cohen', 'Silva', 'Tanaka', 'Brown', 'Reyes', 'Walker'];
const AREAS = ['Downtown', 'Riverside', 'Oak Park', 'Lakeview', 'Hillcrest', 'Midtown', 'Westfield'];

const SOURCES = [
  ['WEBSITE', 35],
  ['FACEBOOK', 25],
  ['ZILLOW', 20],
  ['GOOGLE_ADS', 15],
  ['MANUAL', 5],
] as const satisfies readonly (readonly [Source, number])[];

const STAGES = [
  ['NEW', 10],
  ['CONTACTED', 12],
  ['QUALIFIED', 10],
  ['APPOINTMENT', 8],
  ['CLOSED_WON', 5],
  ['CLOSED_LOST', 5],
] as const satisfies readonly (readonly [Stage, number])[];

// Placeholder for the real scoring function (LP-16); same weights as the PRD.
function score(fields: { preApproved: boolean | null; timelineMonths: number | null; budgetMax: number | null; area: string | null }) {
  let points = 0;
  if (fields.preApproved) points += 30;
  if (fields.timelineMonths !== null && fields.timelineMonths <= 3) points += 25;
  if (fields.budgetMax !== null) points += 15;
  if (fields.area !== null) points += 10;
  const temperature = points >= 60 ? 'HOT' : points >= 30 ? 'WARM' : 'COLD';
  return { score: points, temperature } as const;
}

async function reset() {
  const plan = db.raw.sql`TRUNCATE "ActivityEvent", "Message", "Appointment", "SequenceEnrollment", "SequenceStep", "Sequence", "Lead", "WebhookEvent", "User" RESTART IDENTITY CASCADE`
    .affectedCount()
    .build();
  await db.runtime().execute(plan);
}

async function seedUsers() {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const admin = await db.orm.public.User.create({
    email: 'admin@realestate-system.dev',
    name: 'Alex Admin',
    role: 'ADMIN',
    passwordHash,
  });
  const agent = await db.orm.public.User.create({
    email: 'agent@realestate-system.dev',
    name: 'Jordan Agent',
    role: 'AGENT',
    passwordHash,
  });
  return { admin, agent };
}

async function seedSequence() {
  const sequence = await db.orm.public.Sequence.create({ name: 'New lead', trigger: 'lead.created' });
  const steps = [
    { position: 0, delayMinutes: 60, channel: 'EMAIL', template: 'Hi {{name}}, just checking you saw my message. Are you looking to buy or sell?' },
    { position: 1, delayMinutes: 24 * 60, channel: 'SMS', template: 'Hi {{name}}, it\'s {{agent}} from Realestate System. Happy to share listings in {{area}} whenever you\'re ready.' },
    { position: 2, delayMinutes: 3 * 24 * 60, channel: 'EMAIL', template: 'Hi {{name}}, still thinking about a move? Reply with a good time and I\'ll set up a quick call.' },
  ] as const;
  for (const step of steps) {
    await db.orm.public.SequenceStep.create({ ...step, sequenceId: sequence.id });
  }
  return sequence;
}

const STAGE_ORDER: Stage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT', 'CLOSED_WON'];
function reached(stage: Stage, target: Stage) {
  if (stage === 'CLOSED_LOST') return target === 'NEW' || target === 'CONTACTED';
  return STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(target);
}

async function seedLeads(agentId: string, sequenceId: string) {
  const now = Date.now();
  // Upcoming appointment slots: weekdays at 10:00, 13:00 and 16:00 UTC, starting tomorrow.
  const slotHours = [10, 13, 16];
  let nextSlot = 0;
  const takeSlot = () => {
    const day = Math.floor(nextSlot / slotHours.length) + 1;
    const start = new Date(now + day * DAY_MS);
    start.setUTCHours(slotHours[nextSlot % slotHours.length]!, 0, 0, 0);
    nextSlot += 1;
    return start;
  };

  for (let i = 0; i < LEAD_COUNT; i++) {
    const source = weighted(SOURCES);
    const stage = weighted(STAGES);
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const createdAt = new Date(now - rand() * 56 * DAY_MS);
    const qualified = reached(stage, 'QUALIFIED');

    const intent: Intent = qualified ? weighted([['BUYER', 6], ['SELLER', 3], ['INVESTOR', 1]] as const) : 'UNKNOWN';
    const fields = {
      budgetMax: qualified || rand() < 0.3 ? Math.round(250 + rand() * 950) * 1000 : null,
      area: qualified || rand() < 0.3 ? pick(AREAS) : null,
      timelineMonths: qualified ? pick([1, 2, 3, 6, 12]) : null,
      preApproved: qualified ? rand() < 0.6 : null,
    };
    // Median first response is a few minutes; a few slow ones make the metric interesting.
    const responseDelayMs = (rand() < 0.85 ? 5 + rand() * 60 : 600 + rand() * 3600) * 1000;
    const firstResponseAt = reached(stage, 'CONTACTED') ? new Date(createdAt.getTime() + responseDelayMs) : null;

    const lead = await db.orm.public.Lead.create({
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      phone: `+1555${String(1000000 + Math.floor(rand() * 8999999))}`,
      source,
      stage,
      intent,
      ...fields,
      ...score(fields),
      tags: source === 'MANUAL' ? ['referral'] : [],
      aiEnabled: stage !== 'CLOSED_WON' && stage !== 'CLOSED_LOST',
      assignedToId: agentId,
      firstResponseAt: firstResponseAt?.toISOString() ?? null,
      createdAt: createdAt.toISOString(),
    });

    await db.orm.public.ActivityEvent.create({
      leadId: lead.id,
      type: 'lead.created',
      payload: { source },
      createdAt: createdAt.toISOString(),
    });
    await db.orm.public.Message.create({
      leadId: lead.id,
      channel: 'WEB',
      author: 'LEAD',
      body: `Hi, I'm interested in ${pick(['buying a home', 'selling my place', 'what my house is worth', 'investment properties'])}.`,
      createdAt: createdAt.toISOString(),
    });

    if (firstResponseAt) {
      await db.orm.public.Message.create({
        leadId: lead.id,
        channel: 'WEB',
        author: 'AI',
        body: `Thanks ${first}! Are you looking to buy or sell, and which area are you considering?`,
        meta: { model: 'seed', inputTokens: 0, outputTokens: 0 },
        createdAt: firstResponseAt.toISOString(),
      });
      await db.orm.public.ActivityEvent.create({
        leadId: lead.id,
        type: 'message.sent',
        payload: { author: 'AI', channel: 'WEB' },
        createdAt: firstResponseAt.toISOString(),
      });
    }

    if (qualified) {
      await db.orm.public.ActivityEvent.create({
        leadId: lead.id,
        type: 'lead.qualified',
        payload: { intent, ...score(fields) },
        createdAt: new Date(createdAt.getTime() + DAY_MS).toISOString(),
      });
    }

    if (stage === 'APPOINTMENT') {
      const startsAt = takeSlot();
      await db.orm.public.Appointment.create({
        leadId: lead.id,
        agentId,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 30 * 60 * 1000).toISOString(),
      });
      await db.orm.public.ActivityEvent.create({
        leadId: lead.id,
        type: 'appointment.booked',
        payload: { startsAt: startsAt.toISOString() },
        createdAt: new Date(createdAt.getTime() + 2 * DAY_MS).toISOString(),
      });
    }

    if (stage === 'NEW' || stage === 'CONTACTED') {
      await db.orm.public.SequenceEnrollment.create({
        leadId: lead.id,
        sequenceId,
        currentStep: stage === 'NEW' ? 0 : 1,
      });
    }
  }
}

async function main() {
  await reset();
  const { agent } = await seedUsers();
  const sequence = await seedSequence();
  await seedLeads(agent.id, sequence.id);
  console.log(`Seeded 2 users, 1 sequence and ${LEAD_COUNT} leads. Login password: ${SEED_PASSWORD}`);
}

try {
  await main();
} finally {
  await db.close();
}
