import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Models } from '../../prisma/contract.js';
import type { Db } from '../../prisma/db.js';
import { DB } from '../database/database.module.js';
import { type LeadSource, normalizeEmail, normalizePhone } from './normalize.js';

type Stage = Models.public_Lead['stage'];

const OPEN_STAGES: Stage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT'];

/** A Lead's contact details as they arrived, from any channel (form, webhook). */
export interface LeadIntakeInput {
  name: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  /** Extra context recorded on the activity event, e.g. the raw utm_source. */
  details?: Record<string, unknown>;
}

export interface LeadIntakeResult {
  leadId: string;
  /** False when the person matched an open Lead they already had. */
  created: boolean;
}

// The one way a Lead enters the system. A person has at most one open Lead:
// a returning email (or, failing that, phone) lands on it instead of creating
// another. A person whose only Lead is Closed starts a new one.
@Injectable()
export class LeadIntakeService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async intake(input: LeadIntakeInput): Promise<LeadIntakeResult> {
    const email = input.email === undefined ? null : normalizeEmail(input.email);
    const phone = input.phone === undefined ? null : normalizePhone(input.phone);

    const match = await this.findOpenLead(email, phone);
    if (match) {
      await this.db.orm.public.ActivityEvent.create({
        leadId: match.leadId,
        type: 'lead.duplicate_received',
        payload: {
          matchedBy: match.by,
          source: input.source,
          submitted: { name: input.name, email, phone },
          ...input.details,
        },
      });
      return { leadId: match.leadId, created: false };
    }

    const agent = await this.bookableAgent();
    const leadId = await this.db.transaction(async (tx) => {
      const lead = await tx.orm.public.Lead.create({
        name: input.name,
        email,
        phone,
        source: input.source,
        assignedToId: agent.id,
      });
      await tx.orm.public.ActivityEvent.create({
        leadId: lead.id,
        type: 'lead.created',
        payload: { source: input.source, ...input.details },
      });
      return lead.id;
    });
    return { leadId, created: true };
  }

  private async findOpenLead(
    email: string | null,
    phone: string | null,
  ): Promise<{ leadId: string; by: 'email' | 'phone' } | null> {
    if (email !== null) {
      const lead = await this.openLeads()
        .where((l) => l.email.eq(email))
        .first();
      if (lead) return { leadId: lead.id, by: 'email' };
    }
    if (phone !== null) {
      const lead = await this.openLeads()
        .where((l) => l.phone.eq(phone))
        .first();
      if (lead) return { leadId: lead.id, by: 'phone' };
    }
    return null;
  }

  private openLeads() {
    return this.db.orm.public.Lead.where((l) => l.stage.in(OPEN_STAGES)).orderBy((l) =>
      l.createdAt.desc(),
    );
  }

  // The MVP has exactly one bookable Agent, and every Lead is assigned to them.
  private async bookableAgent() {
    const agent = await this.db.orm.public.User.where({ role: 'AGENT' })
      .orderBy((u) => u.createdAt.asc())
      .first();
    if (!agent) {
      throw new InternalServerErrorException('No bookable Agent exists to assign the Lead to');
    }
    return agent;
  }
}
