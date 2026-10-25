import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type ChatMessage,
  type ChatSessionResponse,
  type SendMessage,
  SendMessageSchema,
  type SendMessageResponse,
} from '@realestate-system/shared';
import { Public } from '../auth/auth.decorators.js';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { LeadIntakeService } from '../leads/lead-intake.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { ChatSession } from './chat-session.decorators.js';
import type { ChatTokenClaims } from './chat-token.service.js';
import { ChatTokenGuard } from './chat-token.guard.js';
import { ChatTokenService } from './chat-token.service.js';

// The Visitor's side of Web Chat. These routes take a chat token, never a
// dashboard login, so they're public as far as the dashboard guard is concerned.
@ApiTags('chat')
@ApiBearerAuth()
@Public()
@Controller('public/chat')
export class PublicChatController {
  constructor(
    private readonly chatTokens: ChatTokenService,
    private readonly intake: LeadIntakeService,
    private readonly messages: MessagesService,
  ) {}

  /** Opens a chat. No Lead exists until the Visitor sends their first message. */
  @Post('sessions')
  @UseGuards(PublicRateLimitGuard)
  start(): ChatSessionResponse {
    return { chatToken: this.chatTokens.issueVisitorToken() };
  }

  /** The first message from a visitor token creates the Lead and returns a token for it. */
  @Post('messages')
  @UseGuards(PublicRateLimitGuard, ChatTokenGuard)
  async send(
    @ChatSession() session: ChatTokenClaims,
    @Body(new ZodValidationPipe(SendMessageSchema)) { body }: SendMessage,
  ): Promise<SendMessageResponse> {
    if (session.leadId !== undefined) {
      const message = await this.messages.receiveFromLead(session.leadId, body);
      return { message, leadId: session.leadId };
    }

    const { leadId } = await this.intake.intake({ source: 'WEBSITE', details: { channel: 'web-chat' } });
    const message = await this.messages.receiveFromLead(leadId, body);
    // Keeps the visitor token's `since`, so the Visitor still sees their first message.
    const chatToken =
      session.since !== undefined
        ? this.chatTokens.issueForLead(leadId, session.since)
        : this.chatTokens.issueFromNow(leadId);
    return { message, leadId, chatToken };
  }

  /** The conversation so far, limited to what the token's `since` allows. */
  @Get('messages')
  @UseGuards(ChatTokenGuard)
  async list(@ChatSession() session: ChatTokenClaims): Promise<ChatMessage[]> {
    if (session.leadId === undefined) return [];
    return this.messages.listForLead(session.leadId, session.since);
  }
}
