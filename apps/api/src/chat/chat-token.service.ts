import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CLOCK, type Clock } from '../clock/clock.js';

export const CHAT_TOKEN_AUDIENCE = 'chat';
const CHAT_TOKEN_LIFETIME = '30d';

export interface ChatTokenClaims {
  leadId: string;
  /**
   * The holder sees only messages created at or after this time. Set on every
   * token that doesn't prove identity (a form submission can carry anyone's
   * email), so it can never unlock a Lead's earlier conversation. Absent only
   * on tokens sent to the Lead's own inbox.
   */
  since?: string;
}

@Injectable()
export class ChatTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** A token for a Lead's Web Chat that covers messages from now on. */
  issueFromNow(leadId: string): string {
    const claims: ChatTokenClaims = { leadId, since: this.clock.now().toISOString() };
    return this.jwt.sign(claims, { audience: CHAT_TOKEN_AUDIENCE, expiresIn: CHAT_TOKEN_LIFETIME });
  }
}
