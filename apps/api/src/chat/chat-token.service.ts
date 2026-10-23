import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CLOCK, type Clock } from '../clock/clock.js';

export const CHAT_TOKEN_AUDIENCE = 'chat';
const CHAT_TOKEN_LIFETIME = '30d';

export interface ChatTokenClaims {
  leadId?: string;
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

  issueVisitorToken(): string {
    const claims: ChatTokenClaims = {
      since: this.clock.now().toISOString(),
    };
    return this.sign(claims);
  }

  issueForLead(leadId: string, since: string): string {
    const claims: ChatTokenClaims = { leadId, since };
    return this.sign(claims);
  }

  /** A token for a Lead's Web Chat that covers messages from now on. */
  issueFromNow(leadId: string): string {
    return this.issueForLead(leadId, this.clock.now().toISOString());
  }

  private sign(claims: ChatTokenClaims): string {
    return this.jwt.sign(claims, {
      audience: CHAT_TOKEN_AUDIENCE,
      expiresIn: CHAT_TOKEN_LIFETIME,
    });
  }

  async verify(token: string): Promise<ChatTokenClaims | null> {
    try {
      const claims = await this.jwt.verifyAsync<ChatTokenClaims>(token, {
        audience: CHAT_TOKEN_AUDIENCE,
      });
      return { leadId: claims.leadId, since: claims.since };
    } catch {
      return null;
    }
  }
}
