import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ChatMessage } from '@realestate-system/shared';
import type { Models } from '../../prisma/contract.js';
import type { Db } from '../../prisma/db.js';
import { CLOCK, type Clock } from '../clock/clock.js';
import { DB } from '../database/database.module.js';
import { ChatGateway } from '../realtime/chat.gateway.js';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type MessageRow = Pick<Models.public_Message, 'id' | 'author' | 'body' | 'createdAt'>;
type LeadRow = Omit<Models.public_Lead, 'assignedTo'>;

// A conversation is a log: messages are added and listed, never edited or
// deleted. Every message takes its time from the Clock, because a chat token's
// `since` does too, and the two are compared.
@Injectable()
export class MessagesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly gateway: ChatGateway,
  ) {}

  /** The Lead wrote in Web Chat. */
  async receiveFromLead(leadId: string, body: string): Promise<ChatMessage> {
    const message = await this.db.transaction(async (tx) => {
      await this.requireLead(tx, leadId);
      const now = this.now();
      const row = await tx.orm.public.Message.create({ leadId, channel: 'WEB', author: 'LEAD', body, createdAt: now });
      await tx.orm.public.ActivityEvent.create({
        leadId,
        type: 'message.received',
        payload: { messageId: row.id, channel: 'WEB' },
        createdAt: now,
      });
      return toChatMessage(row);
    });
    this.gateway.broadcast(leadId, message);
    return message;
  }

  /** The Agent replied from the dashboard. Their first reply is the Lead's First Response. */
  async sendFromAgent(leadId: string, agentId: string, body: string): Promise<ChatMessage> {
    const message = await this.db.transaction(async (tx) => {
      const lead = await this.requireLead(tx, leadId);
      const now = this.now();
      const row = await tx.orm.public.Message.create({ leadId, channel: 'WEB', author: 'AGENT', body, createdAt: now });
      await tx.orm.public.ActivityEvent.create({
        leadId,
        type: 'message.sent',
        payload: { messageId: row.id, channel: 'WEB', author: 'AGENT', agentId },
        createdAt: now,
      });
      await this.recordFirstResponse(tx, lead, now);
      return toChatMessage(row);
    });
    this.gateway.broadcast(leadId, message);
    return message;
  }

  /** An automated notice. Never a First Response (CONTEXT.md). */
  async sendFromSystem(leadId: string, body: string): Promise<ChatMessage> {
    const message = await this.db.transaction(async (tx) => {
      await this.requireLead(tx, leadId);
      const now = this.now();
      const row = await tx.orm.public.Message.create({ leadId, channel: 'WEB', author: 'SYSTEM', body, createdAt: now });
      await tx.orm.public.ActivityEvent.create({
        leadId,
        type: 'message.sent',
        payload: { messageId: row.id, channel: 'WEB', author: 'SYSTEM' },
        createdAt: now,
      });
      return toChatMessage(row);
    });
    this.gateway.broadcast(leadId, message);
    return message;
  }

  /** Oldest first. With `since`, only messages created at or after it. */
  async listForLead(leadId: string, since?: string): Promise<ChatMessage[]> {
    let query = this.db.orm.public.Message.where({ leadId });
    if (since !== undefined) query = query.where((m) => m.createdAt.gte(since));
    const rows = await query.orderBy((m) => m.createdAt.asc()).all();
    return rows.map(toChatMessage);
  }

  // The first Assistant or Agent message sets firstResponseAt and, for a New
  // Lead, moves it to Contacted. Automation only moves a Lead forward.
  private async recordFirstResponse(tx: Tx, lead: LeadRow, now: string): Promise<void> {
    if (lead.firstResponseAt === null) {
      await tx.orm.public.Lead.where({ id: lead.id }).update({ firstResponseAt: now });
    }
    if (lead.stage === 'NEW') {
      await tx.orm.public.Lead.where({ id: lead.id }).update({ stage: 'CONTACTED' });
      await tx.orm.public.ActivityEvent.create({
        leadId: lead.id,
        type: 'lead.stage_changed',
        payload: { from: 'NEW', to: 'CONTACTED', by: 'automation' },
        createdAt: now,
      });
    }
  }

  private async requireLead(tx: Tx, leadId: string): Promise<LeadRow> {
    const lead = await tx.orm.public.Lead.where({ id: leadId }).first();
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private now(): string {
    return this.clock.now().toISOString();
  }
}

export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    // Normalized, so clients can sort by comparing the strings.
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
