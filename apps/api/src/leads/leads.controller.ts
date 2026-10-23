import { Body, Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type ChatMessage, type SendMessage, SendMessageSchema } from '@realestate-system/shared';
import type { Models } from '../../prisma/contract.js';
import type { Db } from '../../prisma/db.js';
import { CurrentUser, type RequestUser, Roles } from '../auth/auth.decorators.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DB } from '../database/database.module.js';
import { MessagesService } from '../messages/messages.service.js';

const RECENT_LEADS_LIMIT = 20;

type LeadRow = Omit<Models.public_Lead, 'assignedTo'>;
type LeadSummary = Pick<LeadRow, 'id' | 'name' | 'email' | 'phone' | 'stage' | 'createdAt'>;
type ActivityRow = Pick<Models.public_ActivityEvent, 'id' | 'type' | 'payload' | 'createdAt'>;

interface LeadDetail {
  lead: LeadRow;
  messages: ChatMessage[];
  activity: ActivityRow[];
}

// The Agent's view of Leads. Behind the dashboard login (the global AuthGuard).
@ApiTags('leads')
@ApiBearerAuth()
@Roles('AGENT', 'ADMIN')
@Controller('leads')
export class LeadsController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly messages: MessagesService,
  ) {}

  /** The newest Leads. A stand-in until the inbox (#21). */
  @Get()
  async recent(): Promise<LeadSummary[]> {
    return this.db.orm.public.Lead.select('id', 'name', 'email', 'phone', 'stage', 'createdAt')
      .orderBy((l) => l.createdAt.desc())
      .limit(RECENT_LEADS_LIMIT)
      .all();
  }

  /** The Lead's profile, every message and the activity timeline, oldest first. */
  @Get(':id')
  async detail(@Param('id') id: string): Promise<LeadDetail> {
    const lead = await this.db.orm.public.Lead.where({ id }).first();
    if (!lead) throw new NotFoundException('Lead not found');

    const [messages, activity] = await Promise.all([
      this.messages.listForLead(id),
      this.db.orm.public.ActivityEvent.where({ leadId: id })
        .select('id', 'type', 'payload', 'createdAt')
        .orderBy((e) => e.createdAt.asc())
        .all(),
    ]);
    return { lead, messages, activity };
  }

  /** The Agent replies in the Lead's Web Chat. */
  @Post(':id/messages')
  async reply(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(SendMessageSchema)) { body }: SendMessage,
  ): Promise<ChatMessage> {
    return this.messages.sendFromAgent(id, user.id, body);
  }
}
