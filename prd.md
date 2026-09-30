# realestate-system — Real Estate AI Automation PRD

Sep 28, 2026 · @Nico

## Overview

realestate-system turns a new real-estate lead into a booked appointment in under a minute, with an AI assistant running the first conversation. It builds the diagram's core loop for real (capture → instant AI reply → qualify → book → pipeline), simulates the paid integrations, and skips the rest.

**Portfolio goals**

- Show architecture a mid-level engineer would design: event-driven modules, a job queue with a separate worker, adapters around every external system.
- Show production habits: validation, idempotent webhooks, tests at three levels, CI, a live deploy.
- Be demoable in 2 minutes by someone who never opens the code.

**The 2-minute demo story**

1. A visitor opens the demo realtor site and fills in the "Find your dream home" form, or opens the chat widget.
2. The AI replies within seconds and asks qualifying questions: buying or selling, budget, area, timeline, pre-approval.
3. As the lead answers, the agent dashboard updates live: intent tag (Buyer / Seller / Investor), Hot / Warm / Cold score, extracted fields.
4. The AI offers open slots and the lead books one in chat. A confirmation email arrives and reminders are scheduled.
5. On the Kanban board the card has moved New → Contacted → Qualified → Appointment. The agent clicks **Take over** and the AI stops replying.
6. **Simulate leads** fires webhooks from fake Facebook, Zillow and Google Ads sources, and the analytics page fills with the funnel, lead sources and median first-response time.

Non-goals: real ad-platform integrations, voice calls, multi-tenant billing.

## Tech stack

NestJS, TypeScript end to end. The portfolio already has a FastAPI app, so this one shows range. It also keeps API, UI and Playwright tests in one language, and Nest + BullMQ fits a system made of workflows and timers.

| Layer    | Choice                                                                                  | Why it's here                                    |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repo     | pnpm workspaces: `apps/api`, `apps/web`, `packages/shared`, `e2e`                       | One install, shared types, one CI                |
| API      | NestJS, Swagger, zod validation pipe, `@nestjs/throttler`, pino, terminus health checks | Modules map 1:1 to the diagram's boxes           |
| Shared   | zod schemas + inferred types in `packages/shared`                                       | API and UI validate the same shapes              |
| Database | PostgreSQL + Prisma 8 (RC): contract-first, `db.orm` / `db.sql` query lanes              | Planned, content-hashed migrations; typed queries; shows a current stack |
| Jobs     | Redis + BullMQ, separate worker entrypoint                                              | Delayed follow-ups, reminders, retries           |
| Realtime | Socket.IO gateway                                                                       | Live Kanban, inbox and chat widget               |
| AI       | Claude Haiku with tool use, behind `LlmProvider`                                        | Cheap, fast; fake provider for tests             |
| Frontend | Next.js, Tailwind, shadcn/ui, dnd-kit, Recharts                                         | Minimal custom CSS, looks polished               |
| Email    | Mailpit locally, Resend in prod                                                         | Real inbox in the demo                           |
| SMS      | Simulated channel adapter                                                               | Same interface a Twilio adapter would use        |
| Tests    | Jest, Supertest, Playwright                                                             | Unit, API integration, E2E                       |
| Infra    | Docker Compose, GitHub Actions, Railway (API, worker, Postgres, Redis), Vercel (web)    | Live link on the README                          |

## Architecture

&#91;embedded content: realestate-system architecture · API, queue, worker\]

The API only validates, writes to Postgres and emits a domain event. Anything slow (the Claude call) or timed (follow-ups, reminders) becomes a BullMQ job. The worker pushes results to the dashboard through the Socket.IO Redis emitter, so the UI updates live.

## Scope

Build the core loop (boxes 2–6 and 9) for real, simulate anything that needs paid accounts or platform approval, and skip the rest. Every simulated part sits behind the same interface a real integration would use.

| #   | Diagram box           | Scope    | What ships                                                                                                                                                         |
| --- | --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Lead sources          | Simulate | One `POST /webhooks/leads/:source` endpoint with normalizers for `facebook`, `zillow`, `google-ads`. A **Simulate leads** button fires realistic fake payloads.    |
| 2   | Capture leads         | Build    | Demo landing page with lead form, `utm_source` tracking, mobile layout. No A/B tests, valuation tool or home search.                                               |
| 3   | Instant AI response   | Build    | AI replies in web chat and by email within seconds. SMS runs through the simulator adapter. No voice agent.                                                        |
| 4   | Qualify & nurture     | Build    | AI asks qualifying questions and extracts fields; rules compute score and tags. One default follow-up sequence and a stale-lead re-engage job. No property alerts. |
| 5   | Book appointments     | Build    | Slots from agent working hours, booking in chat, confirmation email with an `.ics` file, reminders, cancel link. Google Calendar sync is a stretch goal.           |
| 6   | CRM & pipeline        | Build    | Drag-and-drop Kanban, lead detail with activity timeline, inbox, tags, source tracking. No custom fields.                                                          |
| 7   | Deal management       | Partial  | Stages run to Closed Won / Lost; Closed Won triggers a review-request email. No contracts or milestones.                                                           |
| 8   | Integrations          | Simulate | Claude and email are real. Twilio, Zapier, Stripe, DocuSign and MLS are skipped; adapters show where they plug in.                                                 |
| 9   | Analytics & reporting | Build    | Funnel by stage, leads by source, median first-response time, appointments per week.                                                                               |
| 10  | Scaling & growth      | Skip     | Not a feature. The README explains how the design scales (more workers, round-robin assignment).                                                                   |

## Core flows

Every state change emits a domain event and handlers react to it. New features subscribe to events instead of editing the code that emitted them.

**Domain events**

| Event                   | Emitted when                                           | What reacts                                                                                              |
| ----------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `lead.created`          | Form submit or webhook                                 | Enqueue `ai-reply` for the first message; enroll in the "New lead" sequence; push the card to the Kanban |
| `message.received`      | Lead replies on any channel                            | Cancel the pending sequence step; enqueue `ai-reply` if AI is on for this lead                           |
| `message.sent`          | AI, agent or sequence sends                            | First outbound message sets `firstResponseAt` and moves NEW → CONTACTED                                  |
| `lead.qualified`        | Required fields are filled and score is computed       | Stage → QUALIFIED; push the score to the dashboard                                                       |
| `appointment.booked`    | AI tool call or booking page                           | Stage → APPOINTMENT; confirmation email; reminder jobs at 24 h and 1 h before; stop sequences            |
| `appointment.cancelled` | Cancel link or agent                                   | Remove reminder jobs; AI offers new slots                                                                |
| `lead.handoff`          | Agent clicks Take over, or AI calls `handoff_to_human` | AI off for this lead; notify the assigned agent                                                          |
| `lead.closed_won`       | Agent drags card to Closed Won                         | Delayed review-request email                                                                             |

**AI agent tools**

The model never writes to the database. It calls whitelisted tools, and the server validates every call before acting.

| Tool                  | Does                                               | Server-side check                                                     |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| `update_lead_profile` | Saves intent, budget, area, timeline, pre-approval | zod schema; unknown fields dropped                                    |
| `get_available_slots` | Returns the next open slots                        | Future slots inside working hours only                                |
| `book_appointment`    | Books a slot for this lead                         | Slot re-checked in a transaction; unique index on agent + start time  |
| `handoff_to_human`    | Passes the chat to an agent                        | Also forced after a max turn count or when the lead asks for a person |

**Scoring is rules, not the model.** The AI extracts fields; a pure function turns them into a score. Example weights: pre-approved +30, buying within 3 months +25, budget given +15, area given +10. Hot at 60+, Warm at 30+, else Cold. This keeps scoring explainable and unit-testable.

## Data model

Nine models on **Prisma 8** (currently `8.0.0-rc`). Messages hang directly off the lead, with no separate conversation table, to keep queries simple. `ActivityEvent` doubles as the lead timeline and the source for analytics.

The source of truth is the data contract at `apps/api/prisma/contract.prisma`. `pnpm contract:emit` compiles it to `contract.json` + `contract.d.ts`, which the typed client in `apps/api/prisma/db.ts` reads.

**How Prisma 8 shapes the schema**

| Concern | Choice | Why |
| --- | --- | --- |
| Enums | `enum Stage { @@type("pg/text@1") NEW = "NEW" ... }`; defaults are string literals (`@default("NEW")`) | Stored as `text` with a generated `CHECK` constraint, not a native Postgres enum, so adding a value never needs `ALTER TYPE` |
| Timestamps | `TimestamptzString` | Node 24 has no global `Temporal`, which Prisma 8's `Timestamptz` needs; ISO strings avoid a polyfill. Still `timestamptz` in Postgres, always UTC |
| IDs | `String @id @default(cuid(2))` | Prisma 8 requires the cuid version argument |
| JSON | `Jsonb` (`Message.meta`, `ActivityEvent.payload`, `WebhookEvent.payload`) | Plain `Json` maps to `json`; `jsonb` can be indexed and queried |
| Relations | Declared on the owning side only | Prisma 8 derives back-references (`lead.messages`, `user.appointments`) itself |
| Race-safe booking | `@@index([agentId, startsAt], unique: true, where: "status = 'BOOKED'")` in the contract | Partial unique index is first-class, so no hand-written SQL migration |
| Deletes | Lead children (`Message`, `Appointment`, `ActivityEvent`, `SequenceEnrollment`) and `SequenceStep` cascade | Deleting a demo lead or sequence cleans up after itself |

**Changes from the first draft of this PRD**

- `User.createdAt` and `Appointment.createdAt` added.
- `Lead.tags` defaults to `[]`.
- `@@unique` on `Sequence.name` (the seed and sequence lookups key on it) and on `SequenceStep (sequenceId, position)`.
- Foreign-key indexes on `Lead.assignedToId`, `Appointment.leadId`, `SequenceEnrollment.sequenceId`.

Core models, abridged (see the contract for all nine models and nine enums):

```prisma
model Lead {
  id              String             @id @default(cuid(2))
  name            String?
  email           String?
  phone           String?
  source          LeadSource
  intent          Intent             @default("UNKNOWN")
  stage           Stage              @default("NEW")
  score           Int                @default(0)
  temperature     Temperature        @default("COLD")
  budgetMax       Int?
  area            String?
  timelineMonths  Int?
  preApproved     Boolean?
  tags            String[]           @default([])
  aiEnabled       Boolean            @default(true)
  assignedToId    String?
  assignedTo      User?              @relation(fields: [assignedToId], references: [id])
  firstResponseAt TimestamptzString?
  createdAt       TimestamptzString  @default(now())

  @@index([stage])
  @@index([source, createdAt])
  @@index([assignedToId])
}

model Appointment {
  id        String            @id @default(cuid(2))
  leadId    String
  lead      Lead              @relation(fields: [leadId], references: [id], onDelete: Cascade)
  agentId   String
  agent     User              @relation(fields: [agentId], references: [id])
  startsAt  TimestamptzString
  endsAt    TimestamptzString
  status    AppointmentStatus @default("BOOKED")
  createdAt TimestamptzString @default(now())

  @@index([leadId])
  @@index([agentId, startsAt], unique: true, where: "status = 'BOOKED'", name: "appointment_agent_slot_booked")
}
```

**Migrations and seed**

- Local, schema in flux: edit the contract, `pnpm contract:emit`, then `prisma db update` (no migration files).
- Anything shared or deployed: `prisma migration plan --name <slug>` writes a reviewable package under `apps/api/migrations/app/`, and `pnpm db:migrate` (`prisma db migrate`) applies it in one transaction. Commit the migration packages and `migrations/snapshots/`.
- Prisma 8 has no `db seed` command, so `pnpm db:seed` runs `apps/api/prisma/seed.ts` with Node's built-in TypeScript support. It truncates and reseeds deterministically: an admin and an agent (password from `SEED_PASSWORD`, default `demo1234`), the "New lead" sequence, and 50 leads across every source and stage, with messages, activity events, enrollments and upcoming appointments.
- Passwords are hashed with Node's `scrypt` (`apps/api/src/auth/password.ts`), which the auth module reuses.

Working hours and slot length live in config for the MVP. Store every time in UTC and render it in the agent's time zone.

## API surface

About 20 routes, all documented in Swagger at `/docs`. Public routes are rate-limited; the lead's chat uses a short-lived signed token instead of a login.

| Module       | Route                                          | Auth                  | Purpose                                                             |
| ------------ | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| Auth         | `POST /auth/login`                             | Public                | Returns a JWT                                                       |
| Auth         | `GET /auth/me`                                 | JWT                   | Current user and role                                               |
| Leads        | `POST /public/leads`                           | Throttled             | Landing-page form capture                                           |
| Webhooks     | `POST /webhooks/leads/:source`                 | HMAC signature        | Ingest from a lead source; duplicate keys return 200 and do nothing |
| Chat         | `POST /public/chat/sessions`                   | Throttled             | Starts a chat; returns lead id + chat token                         |
| Chat         | `POST /public/chat/:leadId/messages`           | Chat token            | Lead sends a message                                                |
| Chat         | WS `/chat`                                     | Chat token            | AI and agent replies arrive live                                    |
| Booking      | `GET /public/availability`                     | Chat token            | Open slots in a date range                                          |
| Booking      | `POST /public/appointments/:id/cancel`         | Signed link           | Cancel from the email                                               |
| Leads        | `GET /leads`                                   | JWT                   | Filter by stage, source, temperature, search; cursor pagination     |
| Leads        | `GET /leads/:id`                               | JWT                   | Lead, messages and activity timeline                                |
| Leads        | `PATCH /leads/:id`                             | JWT                   | Stage, assignee, tags                                               |
| Leads        | `POST /leads/:id/messages`                     | JWT                   | Agent reply on the lead's channel                                   |
| Leads        | `POST /leads/:id/takeover` and `/resume-ai`    | JWT                   | Turn the AI off or back on                                          |
| Pipeline     | `GET /pipeline`                                | JWT                   | Cards grouped by stage                                              |
| Appointments | `GET /appointments`, `PATCH /appointments/:id` | JWT                   | Calendar list; mark completed or no-show                            |
| Analytics    | `GET /analytics/summary`                       | JWT                   | Funnel, sources, median first-response time                         |
| Sequences    | `GET /sequences`                               | JWT                   | Read-only list of sequences and steps                               |
| Realtime     | WS `/dashboard`                                | JWT                   | `lead.updated`, `message.created`, `appointment.booked`             |
| Dev          | `POST /dev/simulate-leads`                     | Admin, demo mode only | Fires fake webhooks from each source                                |
| Ops          | `GET /health`                                  | Public                | Database and Redis checks                                           |

## Engineering highlights

These are the talking points for interviews; each one should be visible in the code and named in the README.

- **Queue + separate worker.** The API answers fast and never waits on the model. Jobs retry with exponential backoff, and deterministic job ids (`seq:<enrollmentId>:<step>`) mean a retry never sends twice.
- **Signed, idempotent webhooks.** HMAC-SHA256 over the raw body with a timing-safe compare. A unique `idempotencyKey` turns duplicate deliveries into no-ops.
- **LLM behind an interface.** `LlmProvider` has a Claude and a Fake implementation. Tools are whitelisted, tool input is zod-validated, turns are capped, and token usage is logged per message.
- **Scoring as a pure function.** Explainable to the agent, unit-tested with a table of cases.
- **Adapters via Nest DI.** `ChannelAdapter` (web, email, SMS simulator) and one `LeadSourceNormalizer` per source. Adding Twilio is one new class.
- **Race-safe booking.** A transaction plus a partial unique index. The losing request gets a 409 and the AI offers the next slot.
- **Demo time scale.** A `TIME_SCALE` env var divides every delay, so a one-day follow-up fires in seconds during a demo.
- **Ops basics.** Env vars validated with zod at boot, pino logs with a request id carried into jobs, health checks, throttling on public routes, role guards.

## Testing, CI/CD and deployment

Every test in CI uses the Fake LLM, so the suite is free, fast and deterministic. Real Claude calls only happen in the live demo and an optional manual eval.

| Level       | Tool                                                               | Covers                                                                                     | When                 |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------- |
| Unit        | Jest                                                               | Scoring rules, slot generation, source normalizers, HMAC check, sequence delay math        | Every push           |
| Integration | Jest + Supertest, real Postgres and Redis as CI service containers | Webhook creates a lead; duplicate webhook ignored; double booking returns 409; role guards | Every push           |
| Agent loop  | Jest + scripted Fake LLM turns                                     | Tool calls update the lead; booking through a tool; forced handoff after max turns         | Every push           |
| E2E         | Playwright, Page Object Model                                      | Golden path: form → AI chat → booking → card lands in Appointment; agent takeover          | Every push           |
| Live eval   | Script against real Claude, 10 scripted leads                      | Extracted fields match expected values                                                     | Manual, before demos |

**GitHub Actions pipeline**

1. Install with the pnpm cache.
2. Lint and typecheck every package.
3. Run `prisma contract emit`, fail if the committed `contract.json` changed, then `prisma db migrate` against the Postgres service.
4. Unit, integration and agent-loop tests.
5. Build API and web, start them, run Playwright; upload the HTML report and traces on failure.
6. On `main`: Railway and Vercel deploy automatically.

**Deployment**

- Railway: `api` and `worker` services from the same image with different start commands, plus managed Postgres and Redis. `prisma db migrate` runs as a pre-deploy step before the API starts, because Prisma 8 doesn't apply migrations from app code.
- Vercel: `apps/web`.
- Demo safety: a seeded agent login shown on the landing page, a cap on AI turns per lead, a daily cap on Claude calls, and a nightly reseed.

## Milestones

&#91;embedded content: Build order · 6 milestones, about 14 focused days\]

About 14 focused days in total; the estimates are rough. If time runs short, ship M1–M3 plus the Kanban from M5, which already shows the full AI loop. Write the Playwright golden path as soon as M3 works, not at the end.

## Portfolio polish and stretch goals

Reviewers spend about a minute on a repo, so the README does most of the selling.

**Polish checklist**

- [ ] README opens with the live link, a demo login, a 2-minute video or GIF, and the architecture diagram
- [ ] One-command local setup: `docker compose up`, `pnpm db:reset` (migrate + seed), then `pnpm dev`
- [ ] Seed about 50 realistic leads across sources and stages so the analytics page is never empty
- [ ] A "Design decisions" section: why a queue, why rule-based scoring, why a Fake LLM, what was simulated and why
- [ ] Three short ADRs in `docs/adr`
- [ ] CI badge, a link to the latest Playwright report, and Swagger on the live API
- [ ] One PR per milestone with a short description, so the history reads like real team work

**Stretch goals (only after the live link works)**

- Real Twilio SMS adapter on a trial account
- Google Calendar sync for agent availability
- Round-robin assignment across several agents, each with their own hours
- Multi-tenant brokerages with org-scoped queries
- OpenTelemetry traces across API and worker
- Voice agent for inbound calls
